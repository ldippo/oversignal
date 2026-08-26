import * as THREE from "three";

export interface TrackFrame {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
}

export function makeFrame(): TrackFrame {
  return {
    position: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    right: new THREE.Vector3(),
    up: new THREE.Vector3(),
  };
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/**
 * Arc-length addressable track centerline. All gameplay positions are
 * (distance-along, lateral-offset) pairs resolved through frameAt().
 */
export class TrackSpline {
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  readonly closed: boolean;

  constructor(points: THREE.Vector3[], closed = true) {
    this.curve = new THREE.CatmullRomCurve3(points, closed, "centripetal");
    this.curve.arcLengthDivisions = 3000;
    this.length = this.curve.getLength();
    this.closed = closed;
  }

  /** dist in meters; wraps when closed, clamps when open. */
  frameAt(dist: number, out: TrackFrame): TrackFrame {
    let d = dist;
    if (this.closed) {
      d = ((d % this.length) + this.length) % this.length;
    } else {
      d = Math.max(0, Math.min(this.length, d));
    }
    const u = d / this.length;
    this.curve.getPointAt(u, out.position);
    this.curve.getTangentAt(u, out.tangent);
    out.right.crossVectors(out.tangent, WORLD_UP);
    if (out.right.lengthSq() < 1e-6) out.right.set(1, 0, 0);
    out.right.normalize();
    out.up.crossVectors(out.right, out.tangent).normalize();
    return out;
  }
}
