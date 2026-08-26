import type { Run } from "./run";
import type { Ship } from "../ship/ship";

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  apply(run: Run, ship: Ship): void;
}

export const UPGRADE_POOL: Upgrade[] = [
  {
    id: "boost-power",
    name: "OVERTUNED THRUSTERS",
    desc: "Gate boosts are 30% stronger.",
    apply: (run) => { run.mods.boostPower += 0.3; },
  },
  {
    id: "hull-max",
    name: "REINFORCED HULL",
    desc: "+25 max hull, repaired on install.",
    apply: (run) => { run.mods.hullMax += 25; run.heal(25); },
  },
  {
    id: "hull-regen",
    name: "RESONANT PLATING",
    desc: "Perfect gates repair 3 hull.",
    apply: (run) => { run.mods.hullRegenOnBeat += 3; },
  },
  {
    id: "magnet",
    name: "SCRAP MAGNET",
    desc: "Pickup radius greatly increased.",
    apply: (run) => { run.mods.magnetRadius += 3.5; },
  },
  {
    id: "handling",
    name: "GYRO VECTORING",
    desc: "15% sharper steering.",
    apply: (run, ship) => { run.mods.handling += 0.15; ship.stats.lateralSpeed *= 1.15; },
  },
  {
    id: "shield",
    name: "PULSE SHIELD",
    desc: "Ignore one obstacle hit per sector.",
    apply: (run) => { run.mods.shieldPerSegment += 1; run.shields += 1; },
  },
  {
    id: "rhythm-window",
    name: "WIDE GROOVE",
    desc: "On-beat timing window +40ms.",
    apply: (run) => { run.mods.rhythmWindow += 0.04; },
  },
  {
    id: "scrap-doubler",
    name: "SALVAGE RIG",
    desc: "+50% scrap from pickups.",
    apply: (run) => { run.mods.scrapMult += 0.5; },
  },
  {
    id: "top-speed",
    name: "SLIPSTREAM COILS",
    desc: "+30 km/h top speed.",
    apply: (_run, ship) => { ship.stats.maxSpeed += 8.4; },
  },
  {
    id: "accel",
    name: "HOT INTAKES",
    desc: "20% faster acceleration.",
    apply: (_run, ship) => { ship.stats.accel *= 1.2; },
  },
  {
    id: "glass-cannon",
    name: "STRIPPED CHASSIS",
    desc: "+12% top speed, −20 max hull.",
    apply: (run, ship) => {
      ship.stats.maxSpeed *= 1.12;
      run.mods.hullMax = Math.max(30, run.mods.hullMax - 20);
      run.hull = Math.min(run.hull, run.mods.hullMax);
    },
  },
  {
    id: "repair",
    name: "NANO PATCH",
    desc: "Restore 40 hull now.",
    apply: (run) => { run.heal(40); },
  },
];

/** Pick n distinct upgrades. Plain Math.random — draft luck isn't part of the seed. */
export function draftUpgrades(n = 3): Upgrade[] {
  const pool = [...UPGRADE_POOL];
  const picks: Upgrade[] = [];
  while (picks.length < n && pool.length > 0) {
    picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picks;
}
