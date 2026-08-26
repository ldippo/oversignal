/**
 * Fully synthesized SFX — no asset files. Own AudioContext (created on first
 * user gesture), master gain from settings.sfxVolume. Sits under the player's
 * own music, so everything is short, filtered, and mixed conservatively.
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
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
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
    this.master.gain.value = this.volume * 0.6;
    this.master.connect(this.ctx.destination);

    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // engine bed: filtered saw, silent until engineUpdate raises it
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = "sawtooth";
    this.engineOsc.frequency.value = 40;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 220;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v * 0.6;
  }

  private tone(freq: number, dur: number, o: ToneOpts = {}): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (o.delay ?? 0);
    const osc = this.ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t0 + dur);
    const g = this.ctx.createGain();
    const peak = o.gain ?? 0.25;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, filterFreq: number, gain = 0.25, freqEnd?: number, delay = 0): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(filterFreq, t0);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ---------- events ----------

  gatePerfect(combo: number): void {
    const base = 523 * Math.pow(2, Math.min(combo, 8) / 12); // C5 climbing with combo
    this.tone(base, 0.14, { gain: 0.22 });
    this.tone(base * 1.5, 0.22, { gain: 0.2, delay: 0.07 });
  }

  gateMiss(): void {
    this.tone(150, 0.12, { type: "triangle", gain: 0.16 });
  }

  ring(chain: number): void {
    this.tone(660 * Math.pow(2, Math.min(chain, 10) / 12), 0.07, { type: "square", gain: 0.08 });
  }

  core(): void {
    this.tone(523, 0.3, { gain: 0.16 });
    this.tone(659, 0.3, { gain: 0.14, delay: 0.05 });
    this.tone(784, 0.4, { gain: 0.14, delay: 0.1 });
  }

  dash(): void {
    this.noise(0.32, 3200, 0.3, 500);
  }

  shatter(): void {
    this.noise(0.16, 2600, 0.34);
    this.tone(95, 0.22, { type: "sine", gain: 0.3, freqEnd: 50 });
  }

  damage(): void {
    this.tone(110, 0.22, { type: "sawtooth", gain: 0.26, freqEnd: 65 });
    this.noise(0.12, 700, 0.2);
  }

  fencePass(): void {
    this.tone(880, 0.1, { type: "square", gain: 0.1, freqEnd: 220 });
  }

  scrape(): void {
    const now = performance.now();
    if (now - this.lastScrape < 90) return;
    this.lastScrape = now;
    this.noise(0.07, 1600, 0.09);
  }

  overdrive(): void {
    this.tone(200, 1.0, { type: "sawtooth", gain: 0.14, freqEnd: 820, attack: 0.15 });
    this.noise(1.0, 800, 0.12, 3400);
  }

  death(): void {
    this.tone(360, 0.9, { type: "sawtooth", gain: 0.24, freqEnd: 55, attack: 0.01 });
    this.noise(0.5, 1200, 0.2, 150);
  }

  uiClick(): void {
    this.tone(1250, 0.035, { gain: 0.07 });
  }

  warp(): void {
    this.noise(0.9, 600, 0.2, 4200);
  }

  /** Continuous engine bed; speedFrac 0 silences it. */
  engineUpdate(speedFrac: number): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.engineFilter) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(38 + speedFrac * 74, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(180 + speedFrac * 420, t, 0.08);
    this.engineGain.gain.setTargetAtTime(speedFrac > 0.02 ? 0.05 + speedFrac * 0.06 : 0, t, 0.1);
  }
}

export const sfx = new Sfx();
