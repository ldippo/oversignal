import { SpectrumAnalyser } from "./analyser";
import { BeatTracker } from "./beat";
import type { AudioCapture } from "./capture";
import { CURVE_DT, type TrackAnalysis } from "./track-analysis";

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
  // decoded-track mode: precomputed analysis + a playback clock
  private track: TrackAnalysis | null = null;
  private trackClock: (() => number) | null = null;
  private trackLabel = "";
  private trackBeatIdx = -1;

  private baseline = 0.25; // long-EMA of level
  private lull = 0; // seconds spent quiet
  private time = 0;
  private audioNow = 0; // AudioContext clock — beat truth for live capture
  private lastAudio = 0;
  private lastBeatIndex = -1;

  /** Decoded-track mode: exact beats, real drops. Replaces any live capture. */
  setTrack(analysis: TrackAnalysis, clock: () => number, label: string): void {
    this.capture?.stop();
    this.capture = null;
    this.analyser = null;
    if (this.analysisTimer !== null) clearInterval(this.analysisTimer);
    this.analysisTimer = null;
    this.track = analysis;
    this.trackClock = clock;
    this.trackLabel = label;
    this.trackBeatIdx = -1;
    this.bpm = analysis.bpm;
    this.beatConfidence = 1;
    this.dropActive = false;
  }

  get trackMode(): boolean {
    return this.track !== null;
  }

  setCapture(capture: AudioCapture | null): void {
    this.capture?.stop();
    this.track = null;
    this.trackClock = null;
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
    if (this.track) return this.trackLabel;
    return this.capture?.label ?? "none";
  }

  get silent(): boolean {
    return !this.analyser && !this.track;
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

    if (this.track && this.trackClock) {
      const t = this.trackClock();
      const tr = this.track;
      this.bpm = tr.bpm;
      this.beatConfidence = 1;
      const ci = Math.max(0, Math.min(tr.energy.length - 1, Math.floor(t / CURVE_DT)));
      const eTarget = 0.15 + tr.energy[ci] * 0.85;
      this.energy += (eTarget - this.energy) * Math.min(1, 5 * dt);
      this.bass += (tr.bass[ci] - this.bass) * Math.min(1, 10 * dt);
      this.high = this.mid = this.energy * 0.6;
      this.dropActive = tr.drops.some((d) => t >= d.start && t < d.end);

      // beat pulse: advance pointer through the known grid
      if (this.trackBeatIdx >= 0 && (this.trackBeatIdx >= tr.beats.length || tr.beats[this.trackBeatIdx] > t + 1)) {
        this.trackBeatIdx = -1; // queue looped / track changed position
      }
      while (this.trackBeatIdx + 1 < tr.beats.length && tr.beats[this.trackBeatIdx + 1] <= t) {
        this.trackBeatIdx++;
        this.beatPulse = 1;
        this.beatCount++;
      }
      this.beatPulse *= Math.exp(-7 * dt);
      return;
    }

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

  /** Signed seconds to the nearest known beat (track mode only). */
  private trackBeatDist(t: number): number {
    const beats = this.track!.beats;
    if (beats.length === 0) return Infinity;
    let lo = 0;
    let hi = beats.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (beats[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    const after = Math.abs(beats[lo] - t);
    const before = lo > 0 ? Math.abs(beats[lo - 1] - t) : Infinity;
    return Math.min(after, before);
  }

  /** Beat phase 0..1 (0 = on beat), shifted by the latency calibration. */
  phase(): number {
    if (this.track && this.trackClock) {
      const t = this.trackClock() + this.latencyOffset;
      const interval = 60 / this.track.bpm;
      const dist = this.trackBeatDist(t);
      return Math.min(0.999, dist / interval); // 0 at beat, grows away from it
    }
    const t = (this.silent ? this.time : this.audioNow) + this.latencyOffset;
    return this.silent ? ((t % 0.5) + 0.5) % 0.5 / 0.5 : this.beats.phase(t);
  }

  /** True within ±window seconds of the predicted beat. */
  onBeat(window: number): boolean {
    if (this.track && this.trackClock) {
      return this.trackBeatDist(this.trackClock() + this.latencyOffset) <= window;
    }
    const interval = 60 / this.bpm;
    const p = this.phase();
    const offset = Math.min(p, 1 - p) * interval;
    return offset <= window;
  }

  untilNextBeat(): number {
    if (this.track && this.trackClock) {
      const t = this.trackClock() + this.latencyOffset;
      const beats = this.track.beats;
      for (let i = Math.max(0, this.trackBeatIdx); i < beats.length; i++) {
        if (beats[i] > t) return beats[i] - t;
      }
      return 60 / this.bpm;
    }
    if (this.silent) {
      const t = this.time + this.latencyOffset;
      return 0.5 - (((t % 0.5) + 0.5) % 0.5);
    }
    return this.beats.untilNextBeat(this.audioNow + this.latencyOffset);
  }
}
