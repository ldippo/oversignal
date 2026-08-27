import * as THREE from "three";
import { TrackSpline, makeFrame } from "../track/spline";
import type { InputState } from "./input";
import { shipById, type ShipDef } from "../game/ships";

export interface ShipStats {
  maxSpeed: number; // m/s
  accel: number;
  brakeDecel: number;
  coastDecel: number;
  lateralSpeed: number; // max sideways m/s at full steer
}

export const BASE_STATS: ShipStats = {
  maxSpeed: 95,
  accel: 42,
  brakeDecel: 90,
  coastDecel: 18,
  lateralSpeed: 26,
};

const DASH_DURATION = 0.5;

const HOVER_HEIGHT = 1.1;

interface ShipMats {
  body: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  glow: THREE.MeshBasicMaterial;
}

function shipMats(def: ShipDef): ShipMats {
  return {
    body: new THREE.MeshStandardMaterial({ color: def.primary, roughness: 0.35, metalness: 0.7 }),
    accent: new THREE.MeshStandardMaterial({
      color: def.accent,
      emissive: new THREE.Color(def.accent).multiplyScalar(0.5),
      roughness: 0.3,
      metalness: 0.5,
    }),
    glow: new THREE.MeshBasicMaterial({ color: def.accent }),
  };
}

/** Signal-thesis edge treatment: glowing accent wireframe over a dark solid. */
function edgeGlow(mesh: THREE.Mesh, color: number, opacity = 0.85): THREE.LineSegments {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 18),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
  edges.position.copy(mesh.position);
  edges.rotation.copy(mesh.rotation);
  edges.scale.copy(mesh.scale);
  return edges;
}

function nozzle(group: THREE.Group, mats: ShipMats, x: number, y: number, z: number, r = 0.3): void {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 14), mats.glow);
  ring.position.set(x, y, z);
  group.add(ring);
  const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.75, 10), mats.glow);
  core.position.set(x, y, z + 0.02);
  group.add(core);
}

function underglow(group: THREE.Group, mats: ShipMats, w: number, len: number, y = -0.42): void {
  const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, len), mats.glow);
  strip.position.y = y;
  group.add(strip);
}

function buildStinger(g: THREE.Group, mats: ShipMats, def: ShipDef): void {
  const hull = new THREE.Mesh(new THREE.ConeGeometry(1.05, 4.6, 6), mats.body);
  hull.rotation.x = -Math.PI / 2;
  hull.scale.z = 0.45;
  g.add(hull, edgeGlow(hull, def.accent, 0.5));
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), mats.accent);
  canopy.position.set(0, 0.35, 0.4);
  canopy.scale.set(0.75, 0.55, 1.4);
  g.add(canopy);
  // swept rear fins
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.9), mats.body);
    fin.position.set(side * 1.25, 0.05, 1.35);
    fin.rotation.y = side * 0.55;
    g.add(fin, edgeGlow(fin, def.accent, 0.9));
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.5, 4, 8), mats.body);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 1.35, -0.1, 1.0);
    g.add(pod);
    nozzle(g, mats, side * 1.35, -0.1, 1.92, 0.3);
  }
  underglow(g, mats, 0.5, 3.4);
}

function buildJuggernaut(g: THREE.Group, mats: ShipMats, def: ShipDef): void {
  // wide slab bruiser: it grinds walls for a living
  const slab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 3.4), mats.body);
  slab.position.set(0, 0, 0.6);
  g.add(slab, edgeGlow(slab, def.accent, 0.4));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 4), mats.body);
  nose.rotation.x = -Math.PI / 2;
  nose.rotation.z = Math.PI / 4;
  nose.scale.z = 0.32;
  nose.position.set(0, 0, -2.1);
  g.add(nose, edgeGlow(nose, def.accent, 0.4));
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 2.2), mats.body);
  plate.position.set(0, 0.48, 0.7);
  g.add(plate);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), mats.accent);
  canopy.position.set(0, 0.75, 0.1);
  canopy.scale.set(1, 0.55, 1.2);
  g.add(canopy);
  // side rams with glowing rails — the wall-ride identity
  for (const side of [-1, 1]) {
    const ram = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 3.8), mats.body);
    ram.position.set(side * 1.85, 0, 0.5);
    g.add(ram);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 3.6), mats.glow);
    rail.position.set(side * 2.14, 0, 0.5);
    g.add(rail);
    nozzle(g, mats, side * 1.85, 0, 2.42, 0.32);
    nozzle(g, mats, side * 0.75, -0.05, 2.32, 0.28);
  }
  underglow(g, mats, 2.4, 3.2, -0.48);
}

function buildRazor(g: THREE.Group, mats: ShipMats, def: ShipDef): void {
  // needle blade: everything long and thin
  const blade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 6.4, 6), mats.body);
  blade.rotation.x = -Math.PI / 2;
  blade.scale.z = 0.55;
  g.add(blade, edgeGlow(blade, def.accent, 0.7));
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 5.4), mats.glow);
  spine.position.set(0, 0.28, 0.3);
  g.add(spine);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), mats.accent);
  canopy.position.set(0, 0.28, 1.1);
  canopy.scale.set(0.7, 0.5, 1.8);
  g.add(canopy);
  // tail fin + canards
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.15, 1.1), mats.body);
  fin.position.set(0, 0.6, 2.5);
  fin.rotation.x = -0.25;
  g.add(fin, edgeGlow(fin, def.accent, 0.95));
  for (const side of [-1, 1]) {
    const canard = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.45), mats.body);
    canard.position.set(side * 0.55, 0, -1.7);
    canard.rotation.y = side * 0.35;
    g.add(canard, edgeGlow(canard, def.accent, 0.9));
  }
  nozzle(g, mats, 0, 0, 3.1, 0.4);
  underglow(g, mats, 0.3, 4.6, -0.35);
}

function buildMetronome(g: THREE.Group, mats: ShipMats, def: ShipDef): void {
  // tuning-fork catamaran: twin prongs, glowing crossbar
  for (const side of [-1, 1]) {
    const prong = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 3.2, 4, 8), mats.body);
    prong.rotation.x = Math.PI / 2;
    prong.position.set(side * 1.05, 0, 0.2);
    g.add(prong);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.2, 8), mats.body);
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(side * 1.05, 0, -2.0);
    g.add(tip, edgeGlow(tip, def.accent, 0.6));
    const prongGlow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 3.4), mats.glow);
    prongGlow.position.set(side * 0.62, 0.1, 0.2);
    g.add(prongGlow);
    nozzle(g, mats, side * 1.05, 0, 2.05, 0.34);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.35, 1.1), mats.body);
  bridge.position.set(0, 0.1, 1.3);
  g.add(bridge, edgeGlow(bridge, def.accent, 0.5));
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.12), mats.glow);
  crossbar.position.set(0, 0.32, 1.3);
  g.add(crossbar);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mats.accent);
  canopy.position.set(0, 0.42, 1.15);
  canopy.scale.set(0.9, 0.6, 1.1);
  g.add(canopy);
  underglow(g, mats, 1.9, 1.0, -0.32);
}

function buildPhantom(g: THREE.Group, mats: ShipMats, def: ShipDef): void {
  // ghost manta: translucent delta, glowing seams — barely there
  const ghostBody = new THREE.MeshStandardMaterial({
    color: def.primary,
    roughness: 0.25,
    metalness: 0.6,
    transparent: true,
    opacity: 0.72,
  });
  const delta = new THREE.Mesh(new THREE.ConeGeometry(2.3, 4.2, 4), ghostBody);
  delta.rotation.x = -Math.PI / 2;
  delta.rotation.z = Math.PI / 4;
  delta.scale.z = 0.22;
  g.add(delta, edgeGlow(delta, def.accent, 1));
  // forward-swept wingtips
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.7), ghostBody);
    tip.position.set(side * 1.75, 0.05, 0.2);
    tip.rotation.y = -side * 0.5;
    g.add(tip, edgeGlow(tip, def.accent, 1));
  }
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 3.6), mats.glow);
  seam.position.set(0, 0.12, 0.1);
  g.add(seam);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), mats.accent);
  canopy.position.set(0, 0.3, 0.6);
  canopy.scale.set(0.85, 0.5, 1.5);
  g.add(canopy);
  nozzle(g, mats, -0.55, -0.05, 1.98, 0.26);
  nozzle(g, mats, 0.55, -0.05, 1.98, 0.26);
  underglow(g, mats, 1.6, 2.2, -0.3);
}

export function buildShipMesh(def: ShipDef): THREE.Group {
  const group = new THREE.Group();
  const mats = shipMats(def);
  switch (def.id) {
    case "juggernaut": buildJuggernaut(group, mats, def); break;
    case "razor": buildRazor(group, mats, def); break;
    case "metronome": buildMetronome(group, mats, def); break;
    case "phantom": buildPhantom(group, mats, def); break;
    default: buildStinger(group, mats, def);
  }
  const engineLight = new THREE.PointLight(def.accent, 8, 18);
  engineLight.position.set(0, 0.2, 2.2);
  group.add(engineLight);
  return group;
}

function disposeChildren(group: THREE.Group): void {
  for (const child of [...group.children]) {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material as THREE.Material | undefined;
    mat?.dispose();
    group.remove(child);
  }
}

export class Ship {
  s = 0; // distance along track
  lateral = 0;
  speed = 0;
  dashing = false;
  private dashTimer = 0;
  private boostTimer = 0;
  private boostExtra = 0;

  readonly object: THREE.Group;
  stats: ShipStats = { ...BASE_STATS };
  def: ShipDef = shipById("stinger");
  /** groove aura 0..1 — brightens the engine light while regen flows */
  aura = 0;
  private engineLight: THREE.PointLight | null = null;

  private frame = makeFrame();
  private steerSmooth = 0;
  private lateralVel = 0;
  private roll = 0;
  private time = 0;
  private basis = new THREE.Matrix4();
  private wallContact = false;

  constructor(private spline: TrackSpline, private trackHalfWidth: number) {
    this.object = buildShipMesh(this.def);
    this.engineLight = this.object.children.find((c): c is THREE.PointLight => (c as THREE.PointLight).isPointLight) ?? null;
  }

  /** Swap model + apply the def's stat multipliers over base stats. */
  setDef(def: ShipDef): void {
    this.def = def;
    disposeChildren(this.object);
    const built = buildShipMesh(def);
    for (const child of [...built.children]) this.object.add(child);
    this.engineLight = this.object.children.find((c): c is THREE.PointLight => (c as THREE.PointLight).isPointLight) ?? null;
    this.stats = {
      ...BASE_STATS,
      maxSpeed: BASE_STATS.maxSpeed * def.stats.maxSpeedMult,
      accel: BASE_STATS.accel * def.stats.accelMult,
      lateralSpeed: BASE_STATS.lateralSpeed * def.stats.lateralMult,
    };
  }

  setSpline(spline: TrackSpline, halfWidth: number): void {
    this.spline = spline;
    this.trackHalfWidth = halfWidth;
  }

  /** Gate/pickup boost: raises the speed cap briefly and kicks velocity. */
  applyBoost(extra: number, duration: number): void {
    this.boostExtra = Math.max(this.boostExtra * (this.boostTimer > 0 ? 1 : 0), extra);
    this.boostTimer = duration;
    this.speed += 60 * extra;
  }

  /** True on frames where the ship is grinding a wall. */
  get hitWall(): boolean {
    return this.wallContact;
  }

  /** Consume-side of a dash pip: 0.5s surge, i-frames, damped steering. */
  dash(surgeMult = 1): void {
    this.dashTimer = DASH_DURATION * surgeMult;
    this.dashing = true;
    this.speed += 32 * surgeMult;
  }

  /** 0..1 progress through the current dash (for fx). */
  get dashProgress(): number {
    return this.dashing ? 1 - this.dashTimer / DASH_DURATION : 0;
  }

  update(dt: number, input: InputState, speedScale = 1): void {
    this.time += dt;
    const st = this.stats;

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.dashing = this.dashTimer > 0;
    }

    if (this.boostTimer > 0) this.boostTimer -= dt;
    const impulse = this.boostTimer > 0 ? 1 + this.boostExtra : 1;
    const effMax = st.maxSpeed * speedScale * (this.dashing ? 1.6 : 1) * impulse;
    if (input.accel || this.dashing) {
      this.speed += st.accel * (this.dashing ? 1.8 : 1) * dt;
    } else if (input.brake) {
      this.speed -= st.brakeDecel * dt;
    } else {
      this.speed -= st.coastDecel * dt;
    }
    if (this.speed > effMax) {
      this.speed = Math.max(effMax, this.speed - st.brakeDecel * 1.5 * dt);
    }
    if (this.speed < 0) this.speed = 0;

    this.s += this.speed * dt;

    // lateral velocity model: input shapes a target velocity (fast attack,
    // slower release), velocity carries brief momentum — taps micro-adjust,
    // full holds sweep the track in ~0.5s. Dashes commit: authority halves.
    const attack = Math.abs(input.steer) > Math.abs(this.steerSmooth);
    this.steerSmooth += (input.steer - this.steerSmooth) * Math.min(1, (attack ? 12.5 : 8.3) * dt);
    const authority = Math.min(1, this.speed / 30) * (this.dashing ? 0.5 : 1);
    const targetVel = this.steerSmooth * st.lateralSpeed * authority;
    const velRate = Math.abs(targetVel) < Math.abs(this.lateralVel) ? 15 : 10; // stop snappier than start
    this.lateralVel += (targetVel - this.lateralVel) * Math.min(1, velRate * dt);
    this.lateral += this.lateralVel * dt;

    const limit = this.trackHalfWidth - 1.6;
    this.wallContact = false;
    if (this.lateral > limit) {
      this.lateral = limit;
      this.lateralVel = Math.min(0, this.lateralVel);
      this.wallContact = true;
    } else if (this.lateral < -limit) {
      this.lateral = -limit;
      this.lateralVel = Math.max(0, this.lateralVel);
      this.wallContact = true;
    }
    if (this.wallContact) this.speed *= 1 - 1.8 * dt; // scrape friction

    // visual roll follows actual lateral motion, not raw input
    const targetRoll = -(this.lateralVel / st.lateralSpeed) * 0.55;
    this.roll += (targetRoll - this.roll) * Math.min(1, 8 * dt);

    this.pose();
  }

  private pose(): void {
    const f = this.spline.frameAt(this.s, this.frame);
    const hover = HOVER_HEIGHT + Math.sin(this.time * 5.2) * 0.07;
    // light-streak stretch during dash
    const stretch = this.dashing ? 1 + Math.sin(this.dashProgress * Math.PI) * 0.9 : 1;
    this.object.scale.set(1, 1, stretch);
    if (this.engineLight) this.engineLight.intensity = 8 + this.aura * 10;

    this.object.position
      .copy(f.position)
      .addScaledVector(f.right, this.lateral)
      .addScaledVector(f.up, hover);

    // basis: forward = tangent, but three.js models face -Z, so back = -tangent
    const back = f.tangent.clone().negate();
    this.basis.makeBasis(f.right, f.up, back);
    this.object.quaternion.setFromRotationMatrix(this.basis);
    this.object.rotateZ(this.roll);
  }

  /** World-space frame at the ship's current track position (for camera). */
  currentFrame() {
    return this.frame;
  }
}
