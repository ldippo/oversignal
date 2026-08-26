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
  cost: number; // scrap; 0 = starter
  primary: number;
  accent: number;
  bodyScale: [number, number, number]; // x (width), y (height), z (length) on the hull
  stats: ShipStatMods;
}

const S = (over: Partial<ShipStatMods>): ShipStatMods => ({
  maxSpeedMult: 1, accelMult: 1, lateralMult: 1,
  hullDelta: 0, rhythmDelta: 0, boostDelta: 0, shieldPerSegment: 0, magnetDelta: 0,
  ...over,
});

export const SHIPS: ShipDef[] = [
  {
    id: "stinger", name: "STINGER", cost: 0,
    desc: "Balanced factory racer. Does everything, excels at nothing.",
    primary: 0x2244aa, accent: 0x4ef3ff, bodyScale: [1, 1, 1],
    stats: S({}),
  },
  {
    id: "juggernaut", name: "JUGGERNAUT", cost: 300,
    desc: "+40 hull · −8% speed · −10% handling. Built to grind walls and win anyway.",
    primary: 0x1a5a44, accent: 0x8aff6a, bodyScale: [1.35, 1.1, 0.95],
    stats: S({ hullDelta: 40, maxSpeedMult: 0.92, accelMult: 0.95, lateralMult: 0.9 }),
  },
  {
    id: "razor", name: "RAZOR", cost: 500,
    desc: "+12% speed · +20% handling · −25 hull. One mistake from the void.",
    primary: 0x6a1040, accent: 0xff3ec8, bodyScale: [0.75, 0.9, 1.2],
    stats: S({ maxSpeedMult: 1.12, accelMult: 1.05, lateralMult: 1.2, hullDelta: -25 }),
  },
  {
    id: "metronome", name: "METRONOME", cost: 800,
    desc: "+60ms beat window · +25% boost · −10 hull. Lives inside the groove.",
    primary: 0x7a5210, accent: 0xffc44e, bodyScale: [1, 1, 1.05],
    stats: S({ rhythmDelta: 0.06, boostDelta: 0.25, hullDelta: -10 }),
  },
  {
    id: "phantom", name: "PHANTOM", cost: 1200,
    desc: "Sector shield · +3% speed · wider magnet. Slips through everything once.",
    primary: 0x2a1060, accent: 0xb04eff, bodyScale: [0.9, 0.85, 1.1],
    stats: S({ maxSpeedMult: 1.03, lateralMult: 1.05, shieldPerSegment: 1, magnetDelta: 2 }),
  },
];

export function shipById(id: string): ShipDef {
  return SHIPS.find((s) => s.id === id) ?? SHIPS[0];
}
