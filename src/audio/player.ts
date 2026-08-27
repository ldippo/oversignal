import { analyzeBuffer, type TrackAnalysis } from "./track-analysis";

export interface QueuedTrack {
  title: string;
  artist: string;
  artUrl: string | null;
  buffer: AudioBuffer;
  analysis: TrackAnalysis;
}

/**
 * In-app playback for decoded tracks (files + Audius streams). Own
 * AudioContext; getTime() reports the position the LISTENER is hearing
 * (output latency compensated) so the beat grid lines up with their ears.
 */
export class TrackPlayer {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  queue: QueuedTrack[] = [];
  index = 0;
  playing = false;
  onTrackChange: ((track: QueuedTrack) => void) | null = null;

  private startedAt = 0; // ctx time when current track began

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.9;
      this.gain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  async decode(data: ArrayBuffer): Promise<AudioBuffer> {
    return this.ensure().decodeAudioData(data);
  }

  analyze(buffer: AudioBuffer): TrackAnalysis {
    return analyzeBuffer(buffer);
  }

  setQueue(tracks: QueuedTrack[]): void {
    this.stop();
    this.queue = tracks;
    this.index = 0;
  }

  play(index = this.index): void {
    const ctx = this.ensure();
    this.stopSource();
    if (this.queue.length === 0) return;
    this.index = ((index % this.queue.length) + this.queue.length) % this.queue.length;
    const track = this.queue[this.index];
    const src = ctx.createBufferSource();
    src.buffer = track.buffer;
    src.connect(this.gain!);
    src.onended = () => {
      if (this.playing && this.source === src) this.play(this.index + 1); // loop the queue
    };
    src.start();
    this.source = src;
    this.startedAt = ctx.currentTime;
    this.playing = true;
    this.onTrackChange?.(track);
  }

  current(): QueuedTrack | null {
    return this.queue[this.index] ?? null;
  }

  /** Seconds into the current track, as heard (output-latency compensated). */
  getTime(): number {
    if (!this.ctx || !this.playing) return 0;
    const latency = (this.ctx.baseLatency ?? 0) + ((this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0);
    return Math.max(0, this.ctx.currentTime - this.startedAt - latency);
  }

  suspend(): void {
    if (this.ctx?.state === "running") void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private stopSource(): void {
    if (this.source) {
      const s = this.source;
      this.source = null; // clear first so onended doesn't auto-advance
      try { s.stop(); } catch { /* already stopped */ }
    }
  }

  stop(): void {
    this.playing = false;
    this.stopSource();
  }
}
