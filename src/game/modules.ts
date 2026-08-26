import type { RunModifiers } from "./run";

export type ModuleFamily = "DASH" | "TEMPO" | "SALVAGE";

export interface ModuleDef {
  id: string;
  family: ModuleFamily;
  name: string;
  desc: string;
  cost: number;
  apply(mods: RunModifiers): void;
}

export const MODULES: ModuleDef[] = [
  // DASH
  {
    id: "fourth-pip", family: "DASH", name: "FOURTH PIP", cost: 600,
    desc: "+1 max dash pip.",
    apply: (m) => { m.maxPips += 1; },
  },
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
  // TEMPO
  {
    id: "wide-groove", family: "TEMPO", name: "WIDE GROOVE", cost: 350,
    desc: "+40ms on-beat window.",
    apply: (m) => { m.rhythmWindow += 0.04; },
  },
  {
    id: "long-drop", family: "TEMPO", name: "LONG DROP", cost: 400,
    desc: "OVERDRIVE lasts 3s longer.",
    apply: (m) => { m.dropExtend += 3; },
  },
  {
    id: "od-charger", family: "TEMPO", name: "OD CHARGER", cost: 550,
    desc: "OVERDRIVE refills all dash pips.",
    apply: (m) => { m.odCharger = true; },
  },
  // SALVAGE
  {
    id: "magnet-plus", family: "SALVAGE", name: "MAGNET+", cost: 250,
    desc: "+3 pickup radius.",
    apply: (m) => { m.magnetRadius += 3; },
  },
  {
    id: "rich-rings", family: "SALVAGE", name: "RICH RINGS", cost: 500,
    desc: "Rings drop 50% more scrap.",
    apply: (m) => { m.ringScrapMult += 0.5; },
  },
  {
    id: "chain-keeper", family: "SALVAGE", name: "CHAIN KEEPER", cost: 900,
    desc: "One missed ring per chain is forgiven.",
    apply: (m) => { m.chainKeeper = true; },
  },
];

export function moduleById(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}
