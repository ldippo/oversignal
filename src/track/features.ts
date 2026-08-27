import * as THREE from "three";
import { mulberry32 } from "./generator";
import type { Segment } from "./generator";
import { makeFrame } from "./spline";
import type { SectorTheme } from "../fx/palette";
import { dataSpire, transmissionArray, ghostWireframe, shardCluster, heroLandmark } from "../fx/deco";

/**
 * Shape = verb grammar (docs/art-direction.md):
 *   ring/hoop  → fly through (gates, scrap rings)
 *   crystal    → avoid (shard)
 *   wide bar   → lane commit (barrier)
 *   membrane   → pass on the beat (pulse fence)
 */
export type FeatureKind = "gate" | "shard" | "barrier" | "fence" | "ring" | "core";

export interface Feature {
  kind: FeatureKind;
  s: number;
  lateral: number;
  halfW: number;
  mesh: THREE.Object3D;
  taken: boolean;
  mega?: boolean; // once-per-segment double-reward gate
}

export interface FeatureEvent {
  kind: FeatureKind;
  feature: Feature;
  collected: boolean; // rings: false = crossed but missed (breaks chain)
}

export interface FeatureOptions {
  beatConfidence: number; // gates fence spawns
  bpm: number; // ring spacing
}

const GATE_SPACING = 220;
const CRUISE_SPEED = 70; // m/s assumption for beat-distance spacing

// ---------- meshes ----------

function gateMesh(halfWidth: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });
  const postGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 8);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, mat);
    post.position.set(side * halfWidth, 3.5, 0);
    g.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.5, 0.5), mat);
  beam.position.y = 7;
  g.add(beam);
  return g;
}

function shardMesh(color: number): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(1);
  geo.scale(0.9, 3.4, 0.9);
  const core = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x0a0a14, roughness: 0.25, metalness: 0.8 }),
  );
  core.position.y = 2.6;
  core.rotation.x = -0.14; // tilted ~8° toward the player
  g.add(core);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color }),
  );
  edges.position.copy(core.position);
  edges.rotation.copy(core.rotation);
  g.add(edges);
  return g;
}

function barrierMesh(width: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, 2.1, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x0c0c18, roughness: 0.5, metalness: 0.6 }),
  );
  body.position.y = 1.05;
  g.add(body);
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.22, 1.3),
    new THREE.MeshBasicMaterial({ color }),
  );
  strip.position.y = 2.15;
  g.add(strip);
  return g;
}

function fenceMesh(halfWidth: number, color: number): THREE.Mesh {
  // 75% width: the extreme track edges are a narrow no-timing escape lane
  const tex = scanlines().clone();
  tex.needsUpdate = true;
  tex.repeat.set(1, 7);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(halfWidth * 2 * 0.75, 3.2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, alphaMap: tex }),
  );
  m.position.y = 1.6;
  return m;
}

function ringMesh(color: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(1.25, 0.14, 8, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  m.position.y = 1.6;
  return m;
}

function coreMesh(color: number): THREE.Group {
  const g = new THREE.Group();
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), new THREE.MeshBasicMaterial({ color }));
  g.add(crystal);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.9, 0.09, 6, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 }),
  );
  g.add(halo);
  return g;
}

/** Shared scanline alpha texture: the holographic-membrane shimmer. */
let scanlineTex: THREE.Texture | null = null;
function scanlines(): THREE.Texture {
  if (scanlineTex) return scanlineTex;
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 8;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fillRect(0, 0, 4, 5);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(0, 5, 4, 3);
  scanlineTex = new THREE.CanvasTexture(canvas);
  scanlineTex.wrapS = THREE.RepeatWrapping;
  scanlineTex.wrapT = THREE.RepeatWrapping;
  return scanlineTex;
}

function megaGateMesh(halfWidth: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });
  const postGeo = new THREE.CylinderGeometry(0.6, 0.9, 13, 8);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, mat);
    post.position.set(side * halfWidth, 6.5, 0);
    g.add(post);
  }
  for (const h of [10, 13]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.7, 0.7), mat);
    beam.position.y = h;
    g.add(beam);
  }
  return g;
}

function finishArchMesh(halfWidth: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(halfWidth * 0.95, 0.9, 10, 40),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.position.y = 2;
  g.add(ring);
  return g;
}

// ---------- field ----------

export class FeatureField {
  readonly group = new THREE.Group();
  readonly features: Feature[] = [];
  /** Beat-open window as a fraction of the beat cycle (wider when confident). */
  readonly fenceWindowFrac: number;
  readonly hasFences: boolean;

  private nextIdx = 0;
  private gateMeshes: THREE.Group[] = [];
  private fenceMeshes: THREE.Mesh[] = [];
  private spinners: THREE.Object3D[] = [];
  private cores: THREE.Group[] = [];
  private arrayTips: THREE.MeshBasicMaterial[] = [];
  private ghosts: THREE.LineBasicMaterial[] = [];
  private ghostPhases: number[] = [];
  private heroGlow: THREE.MeshBasicMaterial | null = null;
  private arch: THREE.Group | null = null;
  private tunnelArches: THREE.Mesh[] = [];

  constructor(segment: Segment, theme: SectorTheme, opts: FeatureOptions) {
    const rand = mulberry32((segment.seed ^ 0xfeed) >>> 0);
    const { spline, halfWidth, difficulty } = segment;
    const frame = makeFrame();
    const confident = opts.beatConfidence > 0.6;
    this.hasFences = confident;
    this.fenceWindowFrac = 0.25 + Math.min(1, opts.beatConfidence) * 0.15;

    const orient = (mesh: THREE.Object3D, s: number, lateral: number): void => {
      spline.frameAt(s, frame);
      const m = new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.tangent.clone().negate());
      mesh.quaternion.setFromRotationMatrix(m);
      const lift = (mesh.userData.lift as number) ?? 0;
      mesh.position.copy(frame.position).addScaledVector(frame.right, lateral).addScaledVector(frame.up, lift);
    };

    const place = (f: Feature): void => {
      orient(f.mesh, f.s, f.lateral);
      this.features.push(f);
      this.group.add(f.mesh);
    };

    const deco = (mesh: THREE.Object3D, s: number, lateral: number): void => {
      orient(mesh, s, lateral);
      this.group.add(mesh);
    };

    // ideal racing line: hug the inside of the upcoming corner
    const t1 = new THREE.Vector3();
    const t2 = new THREE.Vector3();
    const idealLateral = (s: number): number => {
      spline.frameAt(s, frame);
      t1.copy(frame.tangent);
      spline.frameAt(s + 45, frame);
      t2.copy(frame.tangent);
      const turnY = t1.z * t2.x - t1.x * t2.z; // cross(t1,t2).y
      return THREE.MathUtils.clamp(turnY * 5, -1, 1) * (halfWidth - 4);
    };

    // gates — one MEGA-GATE at ~70% (double reward, guaranteed pip)
    const megaS = spline.length * 0.7;
    for (let s = 300; s < spline.length - 250; s += GATE_SPACING) {
      if (Math.abs(s - megaS) < 80) continue;
      const mesh = gateMesh(halfWidth, theme.gate);
      this.gateMeshes.push(mesh);
      place({ kind: "gate", s, lateral: 0, halfW: halfWidth, mesh, taken: false });
    }
    {
      const mesh = megaGateMesh(halfWidth, theme.gate);
      this.gateMeshes.push(mesh);
      place({ kind: "gate", s: megaS, lateral: 0, halfW: halfWidth, mesh, taken: false, mega: true });
    }

    // blockers: shard 55% / barrier 30% / fence 15% (fence needs beat confidence)
    const blockerS: number[] = [];
    const fenceS: number[] = [];
    const placedBlockers: { s: number; lateral: number }[] = [];
    const nearAny = (s: number, list: number[], minDist: number): boolean =>
      list.some((o) => Math.abs(o - s) < minDist);
    const blockerCount = 10 + difficulty * 6;
    for (let i = 0; i < blockerCount; i++) {
      const s = 350 + rand() * (spline.length - 600);
      const gatePhase = (s - 300) % GATE_SPACING;
      if (gatePhase < 40 || gatePhase > GATE_SPACING - 40) continue;
      if (nearAny(s, blockerS, 60)) continue; // no double-hits
      blockerS.push(s);
      const roll = rand();
      if (roll < 0.55) {
        const lateral = (rand() * 2 - 1) * (halfWidth - 3);
        placedBlockers.push({ s, lateral });
        place({
          kind: "shard", s, lateral,
          halfW: 1.7,
          mesh: shardMesh(theme.obstacle), taken: false,
        });
      } else if (roll < 0.85 || !confident) {
        const width = halfWidth * 1.2; // covers 60% of the track
        const side = rand() < 0.5 ? -1 : 1;
        const lateral = side * halfWidth * 0.4;
        placedBlockers.push({ s, lateral });
        place({
          kind: "barrier", s, lateral,
          halfW: width / 2,
          mesh: barrierMesh(width, theme.obstacle), taken: false,
        });
      } else {
        const mesh = fenceMesh(halfWidth, theme.obstacle);
        this.fenceMeshes.push(mesh);
        fenceS.push(s);
        place({ kind: "fence", s, lateral: 0, halfW: halfWidth * 0.75, mesh, taken: false });
      }
    }

    // ring threads on the racing line, beat-spaced — kept clear of blockers so
    // grabbing scrap never forces damage (35m general, 50m from fences)
    const beatDist = THREE.MathUtils.clamp((CRUISE_SPEED * 60) / opts.bpm / 4, 7, 14);
    const threadSpan = 7 * beatDist;
    const threadClear = (s0: number): boolean => {
      for (let j = 0; j < 8; j++) {
        const s = s0 + j * beatDist;
        if (nearAny(s, blockerS, 35) || nearAny(s, fenceS, 50)) return false;
      }
      return true;
    };
    const threadCount = 6 + Math.floor(difficulty / 2);
    for (let i = 0; i < threadCount; i++) {
      let s0 = -1;
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = 320 + rand() * (spline.length - 600 - threadSpan);
        if (threadClear(candidate)) { s0 = candidate; break; }
      }
      if (s0 < 0) continue; // crowded segment — drop the thread rather than overlap
      for (let j = 0; j < 8; j++) {
        const s = s0 + j * beatDist;
        const mesh = ringMesh(theme.scrap);
        mesh.userData.lift = 1.6;
        place({ kind: "ring", s, lateral: idealLateral(s), halfW: 1.6, mesh, taken: false });
      }
    }

    // CORE pickups: big scrap+hull rewards parked right beside a hazard (risk/reward)
    const coreCount = 2 + Math.floor(difficulty / 3);
    for (let i = 0; i < coreCount && placedBlockers.length > 0; i++) {
      const b = placedBlockers[Math.floor(rand() * placedBlockers.length)];
      const side = rand() < 0.5 ? -1 : 1;
      const lateral = THREE.MathUtils.clamp(b.lateral + side * 3.4, -(halfWidth - 2.5), halfWidth - 2.5);
      const mesh = coreMesh(theme.scrap);
      mesh.userData.lift = 1.8;
      this.cores.push(mesh);
      place({ kind: "core", s: b.s + 7, lateral, halfW: 2, mesh, taken: false });
    }

    // finish arch + approach strip lights (visual only; crossing = finishSegment)
    this.arch = finishArchMesh(halfWidth, theme.gate);
    deco(this.arch, spline.length - 30, 0);
    for (let s = spline.length - 380; s < spline.length - 40; s += 25) {
      for (const side of [-1, 1]) {
        const light = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.25, 2.4),
          new THREE.MeshBasicMaterial({ color: theme.gate }),
        );
        light.userData.lift = 0.15;
        deco(light, s, side * (halfWidth - 1.2));
      }
    }

    // trackside signal architecture (docs/design-language.md)
    for (let s = 160, side = 1; s < spline.length - 100; s += 130 + rand() * 60, side = -side) {
      if (rand() < 0.5) {
        const spire = dataSpire(rand, theme);
        spire.userData.lift = 0;
        this.spinners.push(spire);
        deco(spire, s, side * (halfWidth + 16 + rand() * 14));
      } else {
        const cluster = shardCluster(rand, theme);
        cluster.userData.lift = 8 + rand() * 18;
        this.spinners.push(cluster);
        deco(cluster, s, side * (26 + rand() * 26));
      }
    }
    for (let s = 300; s < spline.length - 100; s += 320 + rand() * 140) {
      const arr = transmissionArray(rand, theme);
      arr.userData.lift = 0;
      this.arrayTips.push(arr.userData.tip as THREE.MeshBasicMaterial);
      deco(arr, s, (rand() < 0.5 ? -1 : 1) * (38 + rand() * 30));
    }
    for (let s = 400; s < spline.length; s += 520 + rand() * 260) {
      const ghost = ghostWireframe(rand, theme);
      ghost.userData.lift = 30 + rand() * 60;
      this.ghosts.push(ghost.userData.ghost as THREE.LineBasicMaterial);
      this.ghostPhases.push(ghost.userData.ghostPhase as number);
      deco(ghost, s, (rand() < 0.5 ? -1 : 1) * (170 + rand() * 140));
    }
    // tunnel sections: arch rings every 18m — flying one on-beat is a drum fill
    for (const sec of segment.sections) {
      if (sec.kind !== "tunnel") continue;
      for (let s = sec.start + 12; s < sec.end - 6; s += 18) {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(halfWidth * 1.15, 0.22, 6, 28),
          new THREE.MeshBasicMaterial({ color: theme.edgeLeft, transparent: true, opacity: 0.7 }),
        );
        arch.userData.lift = 0;
        this.tunnelArches.push(arch);
        deco(arch, s, 0);
      }
    }

    // hero landmark: one per segment, parked on the horizon at the midpoint
    const hero = heroLandmark(rand, theme);
    hero.userData.lift = 110 + rand() * 60;
    this.heroGlow = hero.userData.hero as THREE.MeshBasicMaterial;
    deco(hero, spline.length * 0.5, (rand() < 0.5 ? -1 : 1) * 620);

    this.features.sort((a, b) => a.s - b.s);
  }

  /** fenceOpen: whether the beat window is currently open (main computes once per frame). */
  animate(beatPulse: number, time: number, fenceOpen: boolean, energy = 0.5): void {
    const scale = 1 + beatPulse * 0.12;
    for (const g of this.gateMeshes) g.scale.set(scale, scale, 1);
    if (this.arch) {
      const a = 1 + beatPulse * 0.25;
      this.arch.scale.set(a, a, 1);
    }
    for (const f of this.fenceMeshes) {
      const mat = f.material as THREE.MeshBasicMaterial;
      mat.opacity = fenceOpen ? 0.06 : 0.45 + beatPulse * 0.3;
      mat.alphaMap!.offset.y = time * 0.7; // scanline shimmer
      f.scale.y = fenceOpen ? 0.12 : 1;
    }
    const ringPulse = 1 + beatPulse * 0.18;
    for (const f of this.features) {
      if (f.taken) continue;
      if (f.kind === "ring") {
        f.mesh.rotation.z = time * 1.5;
        f.mesh.scale.setScalar(ringPulse);
      } else if (f.kind === "shard") f.mesh.rotation.y = time * 0.6 + f.s; // corrupted-signal idle spin
      else if (f.kind === "barrier") f.mesh.scale.y = 1 + beatPulse * 0.07;
    }
    for (const c of this.cores) {
      c.rotation.y = time * 1.2;
      c.rotation.x = time * 0.7;
      c.scale.setScalar(1 + beatPulse * 0.22);
    }
    for (const s of this.spinners) {
      s.rotation.y += (s.userData.spin as number) * 0.016;
    }
    for (const tip of this.arrayTips) {
      if (!tip.userData.base) tip.userData.base = tip.color.clone();
      tip.color.copy(tip.userData.base as THREE.Color).multiplyScalar(0.5 + beatPulse * 0.9);
    }
    for (let i = 0; i < this.ghosts.length; i++) {
      const flicker = Math.sin(time * 3.1 + this.ghostPhases[i]) > 0.96 ? 0.14 : 0;
      this.ghosts[i].opacity = 0.1 + flicker;
    }
    if (this.heroGlow) {
      this.heroGlow.opacity = 0.3 + energy * 0.4 + beatPulse * 0.12;
    }
    const archScale = 1 + beatPulse * 0.06;
    for (const a of this.tunnelArches) a.scale.setScalar(archScale);
  }

  /** Sweep [prevS, s]; rings also emit misses (collected: false) to break chains. */
  check(prevS: number, s: number, lateral: number, magnetRadius: number): FeatureEvent[] {
    const events: FeatureEvent[] = [];
    while (this.nextIdx < this.features.length && this.features[this.nextIdx].s <= s) {
      const f = this.features[this.nextIdx];
      this.nextIdx++;
      if (f.taken || f.s < prevS - 1) continue;
      const dist = Math.abs(lateral - f.lateral);
      if (f.kind === "gate") {
        f.taken = true;
        events.push({ kind: f.kind, feature: f, collected: true });
      } else if (f.kind === "fence") {
        // through the membrane = collected; edge lane = miss event (main
        // rewards it as a near-miss only when the fence was closed)
        events.push({ kind: "fence", feature: f, collected: dist < f.halfW });
      } else if (f.kind === "ring" || f.kind === "core") {
        const hit = dist < f.halfW + magnetRadius;
        f.taken = true;
        if (hit) f.mesh.visible = false;
        events.push({ kind: f.kind, feature: f, collected: hit });
      } else {
        // shard / barrier: hit, or a shave inside the near-miss band
        const hitReach = f.halfW + 1.4;
        if (dist < hitReach) {
          f.taken = true;
          f.mesh.visible = false;
          events.push({ kind: f.kind, feature: f, collected: true });
        } else if (dist < hitReach + 2.5) {
          f.taken = true; // one shave per hazard
          events.push({ kind: f.kind, feature: f, collected: false });
        }
      }
    }
    return events;
  }
}
