import * as THREE from "three";
import { mulberry32 } from "./generator";
import type { Segment } from "./generator";
import { makeFrame } from "./spline";

export type FeatureKind = "gate" | "obstacle" | "scrap";

export interface Feature {
  kind: FeatureKind;
  s: number;
  lateral: number;
  halfW: number; // lateral half-extent for collision
  mesh: THREE.Object3D;
  taken: boolean;
}

export interface FeatureEvent {
  kind: FeatureKind;
  feature: Feature;
}

const GATE_SPACING = 220;

export interface FeatureTheme {
  gate: number;
  obstacle: number;
  scrap: number;
}

export const DEFAULT_FEATURE_THEME: FeatureTheme = {
  gate: 0x4ef3ff,
  obstacle: 0xff4a3e,
  scrap: 0xffc44e,
};

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

function obstacleMesh(color: number): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x331018,
    emissive: color,
    emissiveIntensity: 0.55,
    roughness: 0.4,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 3.2), mat);
  m.position.y = 1.2;
  return m;
}

function scrapMesh(color: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color });
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat);
  m.position.y = 1.4;
  return m;
}

/**
 * Seeded placement of gates/obstacles/scrap along a segment, plus the
 * sweep-pointer collision pass (ship s is monotonically increasing).
 */
export class FeatureField {
  readonly group = new THREE.Group();
  readonly features: Feature[] = [];
  private nextIdx = 0;
  private gateMeshes: THREE.Group[] = [];

  constructor(segment: Segment, theme: FeatureTheme = DEFAULT_FEATURE_THEME) {
    const rand = mulberry32((segment.seed ^ 0xfeed) >>> 0);
    const { spline, halfWidth, difficulty } = segment;
    const frame = makeFrame();

    const place = (f: Feature): void => {
      spline.frameAt(f.s, frame);
      const m = new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.tangent.clone().negate());
      f.mesh.quaternion.setFromRotationMatrix(m);
      const lift = f.mesh.userData.lift as number;
      f.mesh.position.copy(frame.position).addScaledVector(frame.right, f.lateral).addScaledVector(frame.up, lift);
      this.features.push(f);
      this.group.add(f.mesh);
    };

    // beat gates: full-width, every GATE_SPACING starting after the lead-in
    for (let s = 300; s < spline.length - 150; s += GATE_SPACING) {
      const mesh = gateMesh(halfWidth, theme.gate);
      mesh.userData.lift = 0;
      this.gateMeshes.push(mesh);
      place({ kind: "gate", s, lateral: 0, halfW: halfWidth, mesh, taken: false });
    }

    // obstacles: dodge blocks, density ramps with difficulty
    const obstacleCount = 8 + difficulty * 6;
    for (let i = 0; i < obstacleCount; i++) {
      const s = 350 + rand() * (spline.length - 500);
      // keep clear of gates so a gate never has a block inside it
      const nearGate = ((s - 300) % GATE_SPACING) < 40 || ((s - 300) % GATE_SPACING) > GATE_SPACING - 40;
      if (nearGate) continue;
      const mesh = obstacleMesh(theme.obstacle);
      mesh.userData.lift = 1.2;
      place({
        kind: "obstacle",
        s,
        lateral: (rand() * 2 - 1) * (halfWidth - 3),
        halfW: 1.6,
        mesh,
        taken: false,
      });
    }

    // scrap: short beat-spaced lines of pickups
    const clusterCount = 5 + Math.floor(difficulty / 2);
    for (let i = 0; i < clusterCount; i++) {
      const s0 = 320 + rand() * (spline.length - 500);
      const lat = (rand() * 2 - 1) * (halfWidth - 4);
      for (let j = 0; j < 5; j++) {
        const mesh = scrapMesh(theme.scrap);
        mesh.userData.lift = 1.4;
        place({ kind: "scrap", s: s0 + j * 9, lateral: lat, halfW: 2.2, mesh, taken: false });
      }
    }

    this.features.sort((a, b) => a.s - b.s);
  }

  /** Pulse gate visuals with the beat. */
  animate(beatPulse: number, time: number): void {
    const scale = 1 + beatPulse * 0.12;
    for (const g of this.gateMeshes) g.scale.set(scale, scale, 1);
    // scrap spin
    for (const f of this.features) {
      if (f.kind === "scrap" && !f.taken) f.mesh.rotation.y = time * 2.2;
    }
  }

  /**
   * Sweep [prevS, s] and emit crossing events. Magnet widens scrap pickup.
   * Returned features are marked taken (gates stay visible).
   */
  check(prevS: number, s: number, lateral: number, magnetRadius: number): FeatureEvent[] {
    const events: FeatureEvent[] = [];
    while (this.nextIdx < this.features.length && this.features[this.nextIdx].s <= s) {
      const f = this.features[this.nextIdx];
      this.nextIdx++;
      if (f.taken || f.s < prevS - 1) continue;
      const dist = Math.abs(lateral - f.lateral);
      const reach = f.kind === "scrap" ? f.halfW + magnetRadius : f.halfW + 1.4;
      if (f.kind === "gate" || dist < reach) {
        f.taken = true;
        if (f.kind !== "gate") f.mesh.visible = false;
        events.push({ kind: f.kind, feature: f });
      }
    }
    return events;
  }
}
