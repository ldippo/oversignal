import * as THREE from "three";

const POINTS = 36;
const MIN_STEP = 0.5; // meters of travel before recording a new point

/** One additive ribbon behind an engine nozzle. */
class Ribbon {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  private history: THREE.Vector3[] = [];
  private positions: Float32Array;

  constructor(scene: THREE.Scene, color: number) {
    this.positions = new Float32Array(POINTS * 2 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    const indices: number[] = [];
    for (let i = 0; i < POINTS - 1; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(indices);
    this.mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  setColor(color: number): void {
    this.mat.color.set(color);
  }

  update(emitter: THREE.Vector3, up: THREE.Vector3, intensity: number): void {
    const last = this.history[0];
    if (!last || last.distanceTo(emitter) > MIN_STEP) {
      this.history.unshift(emitter.clone());
      if (this.history.length > POINTS) this.history.pop();
    } else if (last) {
      last.copy(emitter); // keep head glued to the nozzle
    }

    const n = this.history.length;
    for (let i = 0; i < POINTS; i++) {
      const p = this.history[Math.min(i, n - 1)] ?? emitter;
      const taper = (1 - i / POINTS) * 0.16 + 0.02;
      const o = i * 6;
      this.positions[o] = p.x - up.x * taper;
      this.positions[o + 1] = p.y - up.y * taper;
      this.positions[o + 2] = p.z - up.z * taper;
      this.positions[o + 3] = p.x + up.x * taper;
      this.positions[o + 4] = p.y + up.y * taper;
      this.positions[o + 5] = p.z + up.z * taper;
    }
    (this.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.mat.opacity = 0.12 + intensity * 0.55;
  }
}

/** Twin engine trails; intensity from speed, blazing during dash/overdrive. */
export class ShipTrails {
  private left: Ribbon;
  private right: Ribbon;
  private emitL = new THREE.Vector3();
  private emitR = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene, color: number) {
    this.left = new Ribbon(scene, color);
    this.right = new Ribbon(scene, color);
  }

  setColor(color: number): void {
    this.left.setColor(color);
    this.right.setColor(color);
  }

  update(ship: THREE.Object3D, speedFrac: number, blazing: boolean): void {
    ship.updateMatrixWorld();
    this.emitL.set(-1.35, -0.1, 1.9).applyMatrix4(ship.matrixWorld);
    this.emitR.set(1.35, -0.1, 1.9).applyMatrix4(ship.matrixWorld);
    this.up.set(0, 1, 0).applyQuaternion(ship.quaternion);
    const intensity = Math.min(1, speedFrac) * (blazing ? 1.6 : 1);
    this.left.update(this.emitL, this.up, intensity);
    this.right.update(this.emitR, this.up, intensity);
  }
}
