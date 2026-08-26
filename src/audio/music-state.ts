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
  /** Player-calibrated grid offset in seconds (settings.latencyMs / 1000). */
  latencyOffset = 0;

  private analyser: SpectrumAnalyser | null = null;
  private beats = new BeatTracker();
  private capture: AudioCapture | null = null;
  private analysisTimer: number | null = null;

  private baseline = 0.25; // long-EMA of level
  private lull = 0; // seconds spent quiet
  private time = 0;
  private audioNow = 0; // AudioContext clock — beat truth for live capture
  private lastAudio = 0;
  private lastBeatIndex = -1;

  setCapture(capture: AudioCapture | null): void {
    this.capture?.stop();
    if (this.analysisTimer !== null) clearInterval(this.analysisTimer);
    this.analysisTimer = null;
    this.capture = capture;
    this.analyser = capture?.analyser ? new SpectrumAnalyser(capture.analyser) : null;
    this.beats = new BeatTracker();
    // silent mode's clock is perfect from frame zero; live audio must earn confidence
    this.beatConfidence = this.analyser ? 0 : 1;
    if (!this.analyser) this.bpm = 120;
    // analysis runs on its own steady timer: rAF throttles under load/occlusion
    // and would jitter onset timestamps into useless IOIs
    if (this.analyser) {
      this.analysisTimer = window.setInterval(() => this.analyze(), 25);
    }
  }

  private analyze(): void {
    if (!this.analyser || !this.capture?.ctx) return;
    const now = this.capture.ctx.currentTime;
    const audioDt = now - this.lastAudio;
    // uniform ~20-25ms cadence: flux amplitude is dt-dependent, so irregular
    // sampling from the dual timer/frame drivers would blur onset peaks
    if (audioDt < 0.02) return;
    this.lastAudio = now;
    this.audioNow = now;
    const sdt = Math.min(audioDt, 0.1);
    this.analyser.update();
    const a = this.analyser;

    this.bass += (a.bass - this.bass) * Math.min(1, 18 * sdt);
    this.mid += (a.mid - this.mid) * Math.min(1, 12 * sdt);
    this.high += (a.high - this.high) * Math.min(1, 12 * sdt);

    // baseline: slow EMA; energy: level relative to baseline, centered at 0.5
    this.baseline += (a.level - this.baseline) * Math.min(1, 0.64 * sdt);
    const rel = this.baseline > 0.02 ? a.level / this.baseline : 1;
    const target = Math.max(0, Math.min(1, 0.5 * rel));
    const rate = target > this.energy ? 6 : 2.2; // fast attack, slow release
    this.energy += (target - this.energy) * Math.min(1, rate * sdt);

    this.beats.update(a.flux, now);
    this.bpm = this.beats.bpm;
    this.beatConfidence = this.beats.confidence;

    this.updateDrop(sdt, a.level);
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

  /** Total detected onsets (debug/verification). */
  get debugOnsets(): number {
    return this.beats.onsets;
  }

  update(dt: number): void {
    this.time += dt;

    if (this.analyser) {
      // analysis runs on its own timer (see analyze()) AND from here — the
      // audioDt guard dedupes, and browsers throttle timers and rAF under
      // different conditions, so together coverage stays steady
      this.analyze();
      const now = this.capture?.ctx?.currentTime ?? this.audioNow;
      this.audioNow = now;
      const phase = this.beats.phase(now);
      const beatIndex = Math.floor(now / (60 / this.bpm) - phase);
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

  /** Beat phase 0..1 (0 = on beat), shifted by the latency calibration. */
  phase(): number {
    const t = (this.silent ? this.time : this.audioNow) + this.latencyOffset;
    return this.silent ? ((t % 0.5) + 0.5) % 0.5 / 0.5 : this.beats.phase(t);
  }

  /** True within ±window seconds of the predicted beat. */
  onBeat(window: number): boolean {
    const interval = 60 / this.bpm;
    const p = this.phase();
    const offset = Math.min(p, 1 - p) * interval;
    return offset <= window;
  }

  untilNextBeat(): number {
    if (this.silent) {
      const t = this.time + this.latencyOffset;
      return 0.5 - (((t % 0.5) + 0.5) % 0.5);
    }
    return this.beats.untilNextBeat(this.audioNow + this.latencyOffset);
  }
}
