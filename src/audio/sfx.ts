/**
 * Synthesized SFX, v2 — designed to sit UNDER the player's music, not on it:
 * no continuous drones (the old engine bed competed with the track), every
 * sound is short, the whole bus is high-passed at 180Hz so the music keeps
 * the low end, and the mix is ~7dB quieter than v1.
 */

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  attack?: number;
  freqEnd?: number;
  delay?: number;
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastScrape = 0;
  private volume = 0.5;

  /** Call from a user-gesture handler; no-op afterwards. */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume * 0.3;
    // the music owns the bass — everything we make stays above it
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 180;
    this.master.connect(highpass).connect(this.ctx.destination);

    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v * 0.3;
  }

  private tone(freq: number, dur: number, o: ToneOpts = {}): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (o.delay ?? 0);
    const osc = this.ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t0 + dur);
    const g = this.ctx.createGain();
    const peak = o.gain ?? 0.12;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, filterFreq: number, gain = 0.12, freqEnd?: number, delay = 0): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2; // tiny variation per hit
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.1;
    f.frequency.setValueAtTime(filterFreq, t0);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(60, freqEnd), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ---------- events (short, percussive, mixed low) ----------

  gatePerfect(combo: number): void {
    const base = 523 * Math.pow(2, Math.min(combo, 8) / 12);
    this.tone(base, 0.08, { gain: 0.1 });
    this.tone(base * 1.5, 0.14, { gain: 0.09, delay: 0.05 });
  }

  gateMiss(): void {
    this.tone(240, 0.07, { gain: 0.06, freqEnd: 170 });
  }

  ring(chain: number): void {
    this.tone(740 * Math.pow(2, Math.min(chain, 10) / 12), 0.045, { gain: 0.05 });
  }

  core(): void {
    this.tone(523, 0.16, { gain: 0.08 });
    this.tone(659, 0.16, { gain: 0.07, delay: 0.04 });
    this.tone(784, 0.22, { gain: 0.07, delay: 0.08 });
  }

  dash(): void {
    this.noise(0.2, 2800, 0.14, 700);
  }

  shatter(): void {
    this.noise(0.1, 2400, 0.16);
    this.tone(220, 0.12, { gain: 0.12, freqEnd: 90 });
  }

  damage(): void {
    this.tone(220, 0.13, { gain: 0.13, freqEnd: 95 });
    this.noise(0.07, 900, 0.1);
  }

  fencePass(): void {
    this.tone(880, 0.06, { gain: 0.05, freqEnd: 330 });
  }

  scrape(): void {
    const now = performance.now();
    if (now - this.lastScrape < 110) return;
    this.lastScrape = now;
    this.noise(0.05, 1800, 0.045);
  }

  overdrive(): void {
    this.tone(300, 0.8, { gain: 0.07, freqEnd: 900, attack: 0.12 });
    this.noise(0.8, 1200, 0.06, 3600);
  }

  death(): void {
    this.tone(330, 0.7, { gain: 0.12, freqEnd: 80, attack: 0.01 });
    this.noise(0.4, 1400, 0.1, 250);
  }

  uiClick(): void {
    this.tone(1250, 0.03, { gain: 0.04 });
  }

  nearMiss(): void {
    this.tone(1500, 0.07, { gain: 0.07, freqEnd: 950 });
  }

  heatUp(tier: number): void {
    this.tone(392 * Math.pow(2, Math.min(tier, 6) / 12), 0.1, { gain: 0.09 });
    this.tone(392 * Math.pow(2, Math.min(tier, 6) / 12) * 1.5, 0.14, { gain: 0.07, delay: 0.06 });
  }

  heatDown(): void {
    this.tone(300, 0.09, { gain: 0.07, freqEnd: 180 });
  }

  warp(): void {
    this.noise(0.7, 800, 0.1, 3800);
  }
}

export const sfx = new Sfx();
