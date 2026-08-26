/**
 * Onset detection + tempo/phase tracking over a spectral-flux stream.
 * Detection lags real beats, so consumers use the *predicted* grid
 * (bpm + phase) rather than raw onsets.
 */
export class BeatTracker {
  bpm = 120;
  confidence = 0; // 0..1, how stable the tempo estimate is

  private fluxHist: number[] = [];
  private lastOnset = -10;
  private prevFlux = 0;
  private prevPrevFlux = 0;
  private iois: number[] = [];
  private anchor = 0; // time of an onset the grid is aligned to

  private static HIST = 90; // ~1.5s at 60fps
  private static MIN_IOI = 0.24; // 250 BPM ceiling

  /** Feed one flux sample; returns true if this frame is a detected onset. */
  update(flux: number, now: number): boolean {
    this.fluxHist.push(flux);
    if (this.fluxHist.length > BeatTracker.HIST) this.fluxHist.shift();

    const n = this.fluxHist.length;
    let mean = 0;
    for (const f of this.fluxHist) mean += f;
    mean /= n;
    let variance = 0;
    for (const f of this.fluxHist) variance += (f - mean) * (f - mean);
    const std = Math.sqrt(variance / n);
    const threshold = mean + 1.4 * std + 0.005;

    // local peak: previous frame above threshold and higher than neighbours
    let onset = false;
    if (
      this.prevFlux > threshold &&
      this.prevFlux >= this.prevPrevFlux &&
      this.prevFlux >= flux &&
      now - this.lastOnset > BeatTracker.MIN_IOI
    ) {
      onset = true;
      const ioi = now - this.lastOnset;
      this.lastOnset = now;
      if (ioi < 2.5) {
        this.iois.push(ioi);
        if (this.iois.length > 12) this.iois.shift();
        this.estimateTempo();
      }
      this.realign(now);
    }
    this.prevPrevFlux = this.prevFlux;
    this.prevFlux = flux;
    return onset;
  }

  private estimateTempo(): void {
    if (this.iois.length < 4) return;
    // fold every IOI into 70-180 BPM, then take the median
    const bpms = this.iois.map((ioi) => {
      let b = 60 / ioi;
      while (b < 70) b *= 2;
      while (b > 180) b /= 2;
      return b;
    });
    bpms.sort((a, b) => a - b);
    const median = bpms[Math.floor(bpms.length / 2)];
    // spread → confidence
    const q1 = bpms[Math.floor(bpms.length * 0.25)];
    const q3 = bpms[Math.floor(bpms.length * 0.75)];
    const spread = (q3 - q1) / median;
    this.confidence = Math.max(0, Math.min(1, 1 - spread * 4));
    // ease toward the median so the grid doesn't jump
    this.bpm += (median - this.bpm) * (this.confidence > 0.5 ? 0.4 : 0.15);
  }

  /** Nudge grid anchor toward detected onsets (only when they land near the grid). */
  private realign(now: number): void {
    const interval = 60 / this.bpm;
    const err = ((now - this.anchor) % interval) / interval; // 0..1
    const signed = err > 0.5 ? err - 1 : err;
    if (Math.abs(signed) < 0.35) {
      this.anchor += signed * interval * 0.5;
    } else if (this.confidence < 0.4) {
      this.anchor = now;
    }
  }

  /** Phase 0..1 within the predicted beat grid. */
  phase(now: number): number {
    const interval = 60 / this.bpm;
    return (((now - this.anchor) % interval) + interval) % interval / interval;
  }

  /** Seconds until the next predicted beat. */
  untilNextBeat(now: number): number {
    const interval = 60 / this.bpm;
    return interval * (1 - this.phase(now));
  }
}
