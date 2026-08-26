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
};

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

  constructor(seed: number) {
    this.seed = seed;
    this.hull = this.mods.hullMax;
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
    this.score += points * (1 + this.combo * 0.1);
  }

  addScrap(n: number): void {
    this.scrap += Math.round(n * this.mods.scrapMult);
  }

  /** Scrap payout for the whole run (banked at death). */
  payout(): number {
    return this.scrap + Math.floor(this.distance / 400) + this.segmentIndex * 15;
  }
}
