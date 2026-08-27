export interface RunModifiers {
  hullMax: number;
  boostPower: number; // multiplier on boost strength
  handling: number; // multiplier on lateral speed
  rhythmWindow: number; // seconds of on-beat tolerance
  magnetRadius: number;
  shieldPerSegment: number;
  scrapMult: number;
  hullRegenOnBeat: number; // hull per on-beat gate hit
  maxPips: number; // dash charges
  // HEAT — the earning engine (docs/meta-progression.md)
  maxHeatTier: number;
  heatBuildMult: number;
  heatDecayMult: number;
  heatHitLoss: number; // tiers lost per hit (0.5 insulated, 99 = full reset)
  heatsink: boolean; // at max heat: +1 hull/s
  afterburn: boolean; // dash exit sets heat to max
  scrapeBuildsHeat: boolean; // JUGGERNAUT: wall grinding feeds heat
  // GROOVE — rhythm-linked regen
  grooveRegen: number; // hull/s while the streak is alive
  grooveRegenMult: number;
  grooveGraceS: number; // SECOND WIND: seconds to recover a broken streak
  grooveMissForgive: number; // missed gates forgiven per streak (METRONOME)
  chorusPips: boolean; // groove streak also charges dash pips
  // typed mitigation
  scrapeArmor: number; // wall-grind damage multiplier 0..1
  impactArmor: number; // shard/barrier/fence damage multiplier 0..1
  // dash
  dashDurMult: number;
  pipRefundMult: number; // multiplies pip-siphon refunds (PHANTOM 2x)
  shatterwave: boolean;
  shatterwaveRadius: number; // meters of chain-detonation ahead of a shatter
  pipSiphon: boolean;
  pipSiphonAmount: number;
}

export const BASE_MODIFIERS: RunModifiers = {
  hullMax: 100,
  boostPower: 1,
  handling: 1,
  rhythmWindow: 0.12,
  magnetRadius: 3,
  shieldPerSegment: 0,
  scrapMult: 1,
  hullRegenOnBeat: 0,
  maxPips: 3,
  maxHeatTier: 5,
  heatBuildMult: 1,
  heatDecayMult: 1,
  heatHitLoss: 1,
  heatsink: false,
  afterburn: false,
  scrapeBuildsHeat: false,
  grooveRegen: 2,
  grooveRegenMult: 1,
  grooveGraceS: 0,
  grooveMissForgive: 0,
  chorusPips: false,
  scrapeArmor: 1,
  impactArmor: 1,
  dashDurMult: 1,
  pipRefundMult: 1,
  shatterwave: false,
  shatterwaveRadius: 30,
  pipSiphon: false,
  pipSiphonAmount: 0.5,
};

/** Earnings rebase: heat x1 pays 60% of the old flat rates. */
const REBASE = 0.6;

export class Run {
  readonly seed: number;
  segmentIndex = 0;
  hull: number;
  score = 0;
  scrap = 0;
  combo = 0;
  bestCombo = 0;
  distance = 0;
  shields = 0;
  dashPips = 3; // start full so the first dash teaches itself
  mods: RunModifiers = { ...BASE_MODIFIERS };
  over = false;

  // HEAT: continuous value; tier = 1 + floor(heatValue), capped by maxHeatTier
  heatValue = 0;
  bestHeatTier = 1;
  // GROOVE: streak state
  grooveAlive = false;
  grooveGraceTimer = 0;
  grooveForgivesLeft = 0;

  constructor(seed: number) {
    this.seed = seed;
    this.hull = this.mods.hullMax;
  }

  get heatTier(): number {
    return Math.min(this.mods.maxHeatTier, 1 + Math.floor(this.heatValue));
  }

  /** 0..1 progress toward the next tier (full at max tier). */
  get heatProgress(): number {
    if (this.heatTier >= this.mods.maxHeatTier) return 1;
    return this.heatValue - Math.floor(this.heatValue);
  }

  addHeat(amount: number): void {
    this.heatValue = Math.min(this.mods.maxHeatTier - 1 + 0.999, this.heatValue + amount * this.mods.heatBuildMult);
    this.bestHeatTier = Math.max(this.bestHeatTier, this.heatTier);
  }

  decayHeat(amount: number): void {
    this.heatValue = Math.max(0, this.heatValue - amount * this.mods.heatDecayMult);
  }

  /** Called on any damaging hit: heat tier loss + groove break. */
  onHit(): void {
    this.heatValue = Math.max(0, this.heatValue - this.mods.heatHitLoss);
    this.breakGroove(true);
  }

  /** Keep the groove streak alive (on-beat gate / ring collect). */
  feedGroove(): void {
    if (!this.grooveAlive && this.grooveGraceTimer <= 0) {
      this.grooveForgivesLeft = this.mods.grooveMissForgive;
    }
    this.grooveAlive = true;
    this.grooveGraceTimer = 0;
  }

  /** hard = damage (never forgiven); soft = missed gate/ring. */
  breakGroove(hard: boolean): void {
    if (!this.grooveAlive && this.grooveGraceTimer <= 0) return;
    if (!hard && this.grooveForgivesLeft > 0) {
      this.grooveForgivesLeft--;
      return;
    }
    if (!hard && this.mods.grooveGraceS > 0 && this.grooveGraceTimer <= 0 && this.grooveAlive) {
      this.grooveGraceTimer = this.mods.grooveGraceS; // SECOND WIND window
      this.grooveAlive = false;
      return;
    }
    this.grooveAlive = false;
    this.grooveGraceTimer = 0;
  }

  /** Per-frame groove upkeep; returns hull healed this tick (for fx). */
  grooveTick(dt: number): number {
    if (this.grooveGraceTimer > 0) {
      this.grooveGraceTimer -= dt;
      if (this.grooveGraceTimer > 0) this.grooveAlive = true; // grace keeps it flowing
      else this.grooveAlive = false;
    }
    let healed = 0;
    if (this.grooveAlive && this.hull < this.mods.hullMax) {
      healed = this.mods.grooveRegen * this.mods.grooveRegenMult * dt;
      this.heal(healed);
    }
    if (this.mods.heatsink && this.heatTier >= this.mods.maxHeatTier) {
      this.heal(1 * dt);
    }
    return healed;
  }

  segmentSeed(): number {
    return (this.seed ^ (this.segmentIndex * 0x9e3779b9)) >>> 0;
  }

  damage(amount: number): void {
    if (this.over) return;
    if (amount >= 5 && this.shields > 0) {
      this.shields--;
      return;
    }
    this.hull -= amount;
    if (this.hull <= 0) {
      this.hull = 0;
      this.over = true;
    }
  }

  earnPip(amount = 1): void {
    this.dashPips = Math.min(this.mods.maxPips, this.dashPips + amount);
  }

  heal(amount: number): void {
    this.hull = Math.min(this.mods.hullMax, this.hull + amount);
  }

  addScore(points: number): void {
    this.score += points * REBASE * this.heatTier * (1 + this.combo * 0.1);
  }

  addScrap(n: number): void {
    this.scrap += Math.round(n * REBASE * this.heatTier * this.mods.scrapMult);
  }

  /** Scrap payout for the whole run (banked at death). */
  payout(): number {
    return this.scrap + Math.floor(this.distance / 400) + this.segmentIndex * 15;
  }
}
