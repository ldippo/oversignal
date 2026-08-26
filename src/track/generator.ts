import * as THREE from "three";
import { TrackSpline } from "./spline";

/** Deterministic PRNG so a run seed reproduces its whole track. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SegmentParams {
  seed: number;
  difficulty: number; // 0-based segment index within run
}

export interface Segment {
  spline: TrackSpline;
  halfWidth: number;
  difficulty: number;
  seed: number;
}

const STEP = 60; // meters between control points

export function generateSegment({ seed, difficulty }: SegmentParams): Segment {
  const rand = mulberry32(seed);
  const lengthTarget = 2600 + Math.min(difficulty, 8) * 250;
  const steps = Math.ceil(lengthTarget / STEP);

  // curviness and narrowness ramp with difficulty
  const maxTurn = 0.28 + Math.min(difficulty * 0.045, 0.5); // radians per control point
  const elevAmp = 6 + Math.min(difficulty * 1.5, 14);
  const halfWidth = Math.max(9, 14 - difficulty * 0.5);

  const pts: THREE.Vector3[] = [];
  let heading = 0;
  let x = 0;
  let z = 0;
  let y = 0;
  let yVel = 0;

  // straight lead-in so the player isn't dumped into a corner
  for (let i = 0; i < 3; i++) {
    pts.push(new THREE.Vector3(x, y, z));
    x += Math.sin(heading) * STEP;
    z += Math.cos(heading) * STEP;
  }

  for (let i = 0; i < steps; i++) {
    heading += (rand() * 2 - 1) * maxTurn;
    yVel += (rand() * 2 - 1) * elevAmp * 0.35;
    yVel *= 0.82; // damp so hills stay gentle enough for the up-vector frame math
    y += yVel;
    y *= 0.995;
    x += Math.sin(heading) * STEP;
    z += Math.cos(heading) * STEP;
    pts.push(new THREE.Vector3(x, y, z));
  }

  return { spline: new TrackSpline(pts, false), halfWidth, difficulty, seed };
}
