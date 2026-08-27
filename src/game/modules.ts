import type { RunModifiers } from "./run";

export type ModuleFamily = "HEAT" | "GROOVE" | "DASH";

export interface ModuleDef {
  id: string;
  family: ModuleFamily;
  name: string;
  desc: string;
  cost: number;
  apply(mods: RunModifiers): void;
}

export const MODULES: ModuleDef[] = [
  // HEAT
  {
    id: "insulation", family: "HEAT", name: "INSULATION", cost: 350,
    desc: "Hits cost half a heat tier instead of a full one.",
    apply: (m) => { if (m.heatHitLoss < 99) m.heatHitLoss = 0.5; },
  },
  {
    id: "overclock", family: "HEAT", name: "OVERCLOCK", cost: 600,
    desc: "+1 max heat tier.",
    apply: (m) => { m.maxHeatTier += 1; },
  },
  {
    id: "heatsink", family: "HEAT", name: "HEATSINK", cost: 550,
    desc: "At max heat: +1 hull per second.",
    apply: (m) => { m.heatsink = true; },
  },
  // GROOVE
  {
    id: "wide-groove", family: "GROOVE", name: "WIDE GROOVE", cost: 350,
    desc: "+40ms on-beat window.",
    apply: (m) => { m.rhythmWindow += 0.04; },
  },
  {
    id: "second-wind", family: "GROOVE", name: "SECOND WIND", cost: 400,
    desc: "A broken groove streak gets a 3s grace to recover.",
    apply: (m) => { m.grooveGraceS = 3; },
  },
  {
    id: "chorus", family: "GROOVE", name: "CHORUS", cost: 500,
    desc: "While your groove streak is alive, dash pips slowly charge.",
    apply: (m) => { m.chorusPips = true; },
  },
  // DASH
  {
    id: "shatterwave", family: "DASH", name: "SHATTERWAVE", cost: 450,
    desc: "Dash-shatters detonate nearby hazards for score.",
    apply: (m) => { m.shatterwave = true; },
  },
  {
    id: "pip-siphon", family: "DASH", name: "PIP SIPHON", cost: 500,
    desc: "Each shattered hazard refunds ½ dash pip.",
    apply: (m) => { m.pipSiphon = true; },
  },
  {
    id: "afterburn", family: "DASH", name: "AFTERBURN", cost: 900,
    desc: "Exiting a dash sets HEAT to maximum.",
    apply: (m) => { m.afterburn = true; },
  },
];

/** v1 module ids → v2 equivalents (owned modules and loadouts migrate 1:1). */
export const MODULE_MIGRATION: Record<string, string> = {
  "fourth-pip": "overclock",
  "long-drop": "second-wind",
  "od-charger": "heatsink",
  "magnet-plus": "insulation",
  "rich-rings": "chorus",
  "chain-keeper": "afterburn",
};

export function moduleById(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}
