import * as THREE from "three";
import { TrackSpline, makeFrame } from "../track/spline";
import type { InputState } from "./input";

export interface ShipStats {
  maxSpeed: number; // m/s
  accel: number;
  brakeDecel: number;
  coastDecel: number;
  lateralSpeed: number; // max sideways m/s at full steer
  boostMult: number;
}

export const BASE_STATS: ShipStats = {
  maxSpeed: 95,
  accel: 42,
  brakeDecel: 90,
  coastDecel: 18,
  lateralSpeed: 26,
  boostMult: 1.45,
};

const HOVER_HEIGHT = 1.1;

function buildShipMesh(): THREE.Group {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2244aa,
    roughness: 0.35,
    metalness: 0.7,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x4ef3ff,
    emissive: 0x2288aa,
    roughness: 0.3,
    metalness: 0.5,
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x77e6ff });

  // main hull: stretched cone pointing forward (-Z is three.js forward; we use +tangent, handled by basis)
  const hull = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.6, 6), bodyMat);
  hull.rotation.x = -Math.PI / 2; // cone tip points -Z (model forward)
  hull.scale.y = 1;
  hull.scale.z = 0.45; // flatten
  group.add(hull);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), accentMat);
  canopy.position.set(0, 0.35, 0.4);
  canopy.scale.set(0.8, 0.6, 1.4);
  group.add(canopy);

  const podGeo = new THREE.CapsuleGeometry(0.38, 1.6, 4, 8);
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(podGeo, bodyMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(side * 1.35, -0.1, 0.9);
    group.add(pod);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.2, 10), glowMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(side * 1.35, -0.1, 1.85);
    group.add(nozzle);
  }

  const engineLight = new THREE.PointLight(0x55ccff, 8, 18);
  engineLight.position.set(0, 0.2, 2.2);
  group.add(engineLight);

  return group;
}

export class Ship {
  s = 0; // distance along track
  lateral = 0;
  speed = 0;
  boosting = false;
  private boostTimer = 0;
  private boostExtra = 0;

  readonly object: THREE.Group;
  stats: ShipStats = { ...BASE_STATS };

  private frame = makeFrame();
  private roll = 0;
  private time = 0;
  private basis = new THREE.Matrix4();
  private wallContact = false;

  constructor(private spline: TrackSpline, private trackHalfWidth: number) {
    this.object = buildShipMesh();
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

  update(dt: number, input: InputState, speedScale = 1): void {
    this.time += dt;
    const st = this.stats;
    this.boosting = input.boost;

    if (this.boostTimer > 0) this.boostTimer -= dt;
    const impulse = this.boostTimer > 0 ? 1 + this.boostExtra : 1;
    const effMax = st.maxSpeed * speedScale * (this.boosting ? st.boostMult : 1) * impulse;
    if (input.accel || this.boosting) {
      this.speed += st.accel * (this.boosting ? 1.6 : 1) * dt;
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

    // steering scales with forward speed so a stopped ship doesn't strafe
    const steerAuthority = Math.min(1, this.speed / 30);
    this.lateral += input.steer * st.lateralSpeed * steerAuthority * dt;

    const limit = this.trackHalfWidth - 1.6;
    this.wallContact = false;
    if (this.lateral > limit) {
      this.lateral = limit;
      this.wallContact = true;
    } else if (this.lateral < -limit) {
      this.lateral = -limit;
      this.wallContact = true;
    }
    if (this.wallContact) this.speed *= 1 - 1.8 * dt; // scrape friction

    // visual roll into the turn
    const targetRoll = -input.steer * 0.45;
    this.roll += (targetRoll - this.roll) * Math.min(1, 8 * dt);

    this.pose();
  }

  private pose(): void {
    const f = this.spline.frameAt(this.s, this.frame);
    const hover = HOVER_HEIGHT + Math.sin(this.time * 5.2) * 0.07;

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
