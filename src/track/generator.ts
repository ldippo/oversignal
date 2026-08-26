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

export type SectionKind = "straight" | "sweeper" | "chicane" | "wave" | "tunnel";

export interface Section {
  kind: SectionKind;
  start: number; // meters along the segment (approximate, control-point spaced)
  end: number;
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
  sections: Section[];
}

const STEP = 60; // meters between control points

interface SectionSpec {
  kind: SectionKind;
  weight: number;
  minLen: number;
  maxLen: number;
}

function sectionTable(difficulty: number): SectionSpec[] {
  const d = Math.min(difficulty, 8);
  return [
    { kind: "straight", weight: 0.24, minLen: 280, maxLen: 480 },
    { kind: "sweeper", weight: 0.26, minLen: 380, maxLen: 600 },
    { kind: "chicane", weight: 0.16 + d * 0.015, minLen: 240, maxLen: 420 },
    { kind: "wave", weight: 0.14 + d * 0.01, minLen: 300, maxLen: 480 },
    { kind: "tunnel", weight: 0.16, minLen: 240, maxLen: 360 },
  ];
}

function pickSection(rand: () => number, table: SectionSpec[]): SectionSpec {
  const total = table.reduce((s, t) => s + t.weight, 0);
  let roll = rand() * total;
  for (const t of table) {
    roll -= t.weight;
    if (roll <= 0) return t;
  }
  return table[0];
}

/**
 * Section-based generation: a segment is a seeded sequence of STRAIGHT /
 * SWEEPER / CHICANE / WAVE / TUNNEL sections, so tracks have signature
 * moments instead of uniform wobble. Section ranges are exported for
 * features.ts (tunnel arches, etc.).
 */
export function generateSegment({ seed, difficulty }: SegmentParams): Segment {
  const rand = mulberry32(seed);
  const lengthTarget = 2600 + Math.min(difficulty, 8) * 250;
  const turnScale = 1 + Math.min(difficulty * 0.08, 0.7);
  const elevAmp = 6 + Math.min(difficulty * 1.5, 14);
  const halfWidth = Math.max(9, 14 - difficulty * 0.5);

  const pts: THREE.Vector3[] = [];
  const sections: Section[] = [];
  let heading = 0;
  let x = 0;
  let z = 0;
  let y = 0;
  let yVel = 0;
  let dist = 0;

  const push = (): void => {
    pts.push(new THREE.Vector3(x, y, z));
    x += Math.sin(heading) * STEP;
    z += Math.cos(heading) * STEP;
    dist += STEP;
  };

  // straight lead-in so the player isn't dumped into a corner
  for (let i = 0; i < 3; i++) push();

  while (dist < lengthTarget) {
    const spec = pickSection(rand, sectionTable(difficulty));
    const secLen = spec.minLen + rand() * (spec.maxLen - spec.minLen);
    const steps = Math.max(3, Math.ceil(secLen / STEP));
    const start = dist;
    const sweepDir = rand() < 0.5 ? -1 : 1;
    const sweepRate = (0.1 + rand() * 0.1) * turnScale;
    const chicaneRate = (0.3 + rand() * 0.15) * turnScale;

    for (let i = 0; i < steps; i++) {
      switch (spec.kind) {
        case "straight":
        case "tunnel":
          heading += (rand() * 2 - 1) * 0.06;
          yVel *= 0.7;
          break;
        case "sweeper":
          heading += sweepDir * sweepRate + (rand() * 2 - 1) * 0.04;
          yVel *= 0.8;
          break;
        case "chicane":
          heading += (Math.floor(i / 2) % 2 === 0 ? 1 : -1) * sweepDir * chicaneRate;
          yVel *= 0.8;
          break;
        case "wave":
          heading += (rand() * 2 - 1) * 0.1;
          yVel += (rand() * 2 - 1) * elevAmp * 0.6;
          yVel *= 0.88;
          break;
      }
      y += yVel;
      y *= 0.995;
      push();
    }
    sections.push({ kind: spec.kind, start, end: dist });
  }

  return { spline: new TrackSpline(pts, false), halfWidth, difficulty, seed, sections };
}
