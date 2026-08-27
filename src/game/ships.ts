import type { RunModifiers } from "./run";

export interface ShipStatMods {
  maxSpeedMult: number;
  accelMult: number;
  lateralMult: number;
  hullDelta: number;
  rhythmDelta: number; // seconds added to on-beat window
  boostDelta: number; // added to boostPower multiplier
  shieldPerSegment: number;
  magnetDelta: number;
}

export interface ShipDef {
  id: string;
  name: string;
  desc: string;
  ruleDesc: string; // the signature rule, shown prominently in the hangar
  cost: number; // scrap; 0 = starter
  primary: number;
  accent: number;
  trail: [number, number, number]; // engine-trail emitter offset (±x, y, z)
  slots: number; // module sockets
  stats: ShipStatMods;
  /** The RULE — one mechanic-level bend per ship (docs/meta-progression.md). */
  applyRule: (mods: RunModifiers) => void;
}

const S = (over: Partial<ShipStatMods>): ShipStatMods => ({
  maxSpeedMult: 1, accelMult: 1, lateralMult: 1,
  hullDelta: 0, rhythmDelta: 0, boostDelta: 0, shieldPerSegment: 0, magnetDelta: 0,
  ...over,
});

export const SHIPS: ShipDef[] = [
  {
    id: "stinger", name: "STINGER", cost: 0, slots: 2,
    desc: "Balanced factory racer.",
    ruleDesc: "HEAT bleeds half as fast — forgiveness for learning the flow.",
    primary: 0x2244aa, accent: 0x4ef3ff, trail: [1.35, -0.1, 1.9],
    stats: S({}),
    applyRule: (m) => { m.heatDecayMult = 0.5; },
  },
  {
    id: "juggernaut", name: "JUGGERNAUT", cost: 300, slots: 2,
    desc: "+40 hull · −8% speed · −10% handling.",
    ruleDesc: "Wall scrapes deal ZERO damage and BUILD heat — the wall is your racing line.",
    primary: 0x1a5a44, accent: 0x8aff6a, trail: [1.9, -0.1, 2.2],
    stats: S({ hullDelta: 40, maxSpeedMult: 0.92, accelMult: 0.95, lateralMult: 0.9 }),
    applyRule: (m) => { m.scrapeArmor = 0; m.scrapeBuildsHeat = true; },
  },
  {
    id: "razor", name: "RAZOR", cost: 500, slots: 3,
    desc: "+12% speed · +20% handling · −25 hull.",
    ruleDesc: "HEAT builds 2× and caps at ×6 — but any hit resets it to ×1.",
    primary: 0x6a1040, accent: 0xff3ec8, trail: [0.35, -0.05, 3.1],
    stats: S({ maxSpeedMult: 1.12, accelMult: 1.05, lateralMult: 1.2, hullDelta: -25 }),
    applyRule: (m) => { m.heatBuildMult = 2; m.maxHeatTier = 6; m.heatHitLoss = 99; },
  },
  {
    id: "metronome", name: "METRONOME", cost: 800, slots: 3,
    desc: "+60ms beat window · +25% boost · −10 hull.",
    ruleDesc: "GROOVE survives one missed gate, and regenerates hull twice as fast.",
    primary: 0x7a5210, accent: 0xffc44e, trail: [1.05, -0.05, 2.1],
    stats: S({ rhythmDelta: 0.06, boostDelta: 0.25, hullDelta: -10 }),
    applyRule: (m) => { m.grooveMissForgive = 1; m.grooveRegenMult = 2; },
  },
  {
    id: "phantom", name: "PHANTOM", cost: 1200, slots: 3,
    desc: "+3% speed · +5% handling · wider magnet.",
    ruleDesc: "Dashes last 50% longer with doubled refunds — but only 2 pips. The scalpel.",
    primary: 0x2a1060, accent: 0xb04eff, trail: [0.55, -0.1, 2.0],
    stats: S({ maxSpeedMult: 1.03, lateralMult: 1.05, magnetDelta: 2 }),
    applyRule: (m) => { m.dashDurMult = 1.5; m.pipRefundMult = 2; m.maxPips = 2; },
  },
];

export function shipById(id: string): ShipDef {
  return SHIPS.find((s) => s.id === id) ?? SHIPS[0];
}
