import { SpectrumAnalyser } from "./analyser";
import { BeatTracker } from "./beat";
import type { AudioCapture } from "./capture";

/**
 * The one object gameplay reads music from. Every field is smoothed and
 * framerate-safe; silent mode runs a deterministic 120 BPM internal clock
 * so all mechanics work without audio.
 */
export class MusicState {
  energy = 0.5; // 0..1 smoothed loudness vs recent baseline
  bass = 0;
  mid = 0;
  high = 0;
  beatPulse = 0; // 1 on beat, exponential decay — drive visuals with this
  bpm = 120;
  beatCount = 0; // total predicted beats since capture start
  beatConfidence = 0;
  dropActive = false;
  dropTimer = 0;

  private analyser: SpectrumAnalyser | null = null;
  private beats = new BeatTracker();
  private capture: AudioCapture | null = null;

  private baseline = 0.25; // long-EMA of level
  private lull = 0; // seconds spent quiet
  private time = 0;
  private lastBeatIndex = -1;

  setCapture(capture: AudioCapture | null): void {
    this.capture?.stop();
    this.capture = capture;
    this.analyser = capture?.analyser ? new SpectrumAnalyser(capture.analyser) : null;
    this.beats = new BeatTracker();
  }

  get sourceLabel(): string {
    return this.capture?.label ?? "none";
  }

  get silent(): boolean {
    return !this.analyser;
  }

  /** Raw flux for the debug overlay. */
  get debugFlux(): number {
    return this.analyser?.flux ?? 0;
  }

  update(dt: number): void {
    this.time += dt;

    if (this.analyser) {
      this.analyser.update();
      const a = this.analyser;

      this.bass += (a.bass - this.bass) * Math.min(1, 18 * dt);
      this.mid += (a.mid - this.mid) * Math.min(1, 12 * dt);
      this.high += (a.high - this.high) * Math.min(1, 12 * dt);

      // baseline: slow EMA; energy: level relative to baseline, centered at 0.5
      this.baseline += (a.level - this.baseline) * Math.min(1, 0.08 * dt * 8);
      const rel = this.baseline > 0.02 ? a.level / this.baseline : 1;
      const target = Math.max(0, Math.min(1, 0.5 * rel));
      const rate = target > this.energy ? 6 : 2.2; // fast attack, slow release
      this.energy += (target - this.energy) * Math.min(1, rate * dt);

      this.beats.update(a.flux, this.time);
      this.bpm = this.beats.bpm;
      this.beatConfidence = this.beats.confidence;

      this.updateDrop(dt, a.level);

      // pulse from the *predicted* grid, not raw onsets
      const phase = this.beats.phase(this.time);
      const beatIndex = Math.floor(this.time / (60 / this.bpm) - phase);
      if (phase < 0.12 && beatIndex !== this.lastBeatIndex) {
        this.beatPulse = 1;
        this.beatCount++;
        this.lastBeatIndex = beatIndex;
      }
    } else {
      // silent fallback: fixed 120 BPM clock, gentle energy sine
      this.bpm = 120;
      this.beatConfidence = 1;
      this.energy = 0.5 + Math.sin(this.time * 0.21) * 0.12;
      this.bass = 0.35 + Math.sin(this.time * (Math.PI * 4)) * 0.1;
      const interval = 0.5;
      const idx = Math.floor(this.time / interval);
      if (idx !== this.lastBeatIndex) {
        this.beatPulse = 1;
        this.beatCount++;
        this.lastBeatIndex = idx;
      }
      this.dropActive = false;
    }

    this.beatPulse *= Math.exp(-7 * dt);
    if (this.dropTimer > 0) {
      this.dropTimer -= dt;
      if (this.dropTimer <= 0) this.dropActive = false;
    }
  }

  private updateDrop(dt: number, level: number): void {
    if (this.dropActive) return;
    const rel = this.baseline > 0.02 ? level / this.baseline : 1;
    if (rel < 0.75) {
      this.lull += dt;
    } else if (rel > 1.3 && this.lull > 1.2) {
      // spike after a sustained lull = the drop
      this.dropActive = true;
      this.dropTimer = 6;
      this.lull = 0;
    } else if (rel > 0.95) {
      this.lull = Math.max(0, this.lull - dt * 2);
    }
  }

  /** Beat phase 0..1 (0 = on beat). */
  phase(): number {
    return this.silent ? (this.time % 0.5) / 0.5 : this.beats.phase(this.time);
  }

  /** True within ±window seconds of the predicted beat. */
  onBeat(window: number): boolean {
    const interval = 60 / this.bpm;
    const p = this.phase();
    const offset = Math.min(p, 1 - p) * interval;
    return offset <= window;
  }

  untilNextBeat(): number {
    if (this.silent) return 0.5 - (this.time % 0.5);
    return this.beats.untilNextBeat(this.time);
  }
}
