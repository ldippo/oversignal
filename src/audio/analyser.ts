/** Per-frame spectrum reader: normalized band levels + spectral flux. */
export class SpectrumAnalyser {
  private freq: Uint8Array<ArrayBuffer>;
  private prevFreq: Uint8Array<ArrayBuffer>;
  private binHz: number;

  bass = 0; // ~20-160 Hz
  mid = 0; // ~160-2000 Hz
  high = 0; // ~2-8 kHz
  level = 0; // full-spectrum average
  flux = 0; // positive spectral change (onset signal)

  constructor(private node: AnalyserNode) {
    this.freq = new Uint8Array(node.frequencyBinCount);
    this.prevFreq = new Uint8Array(node.frequencyBinCount);
    this.binHz = node.context.sampleRate / node.fftSize;
  }

  private bandAvg(loHz: number, hiHz: number): number {
    const lo = Math.max(0, Math.floor(loHz / this.binHz));
    const hi = Math.min(this.freq.length - 1, Math.ceil(hiHz / this.binHz));
    let sum = 0;
    for (let i = lo; i <= hi; i++) sum += this.freq[i];
    return sum / ((hi - lo + 1) * 255);
  }

  update(): void {
    [this.prevFreq, this.freq] = [this.freq, this.prevFreq];
    this.node.getByteFrequencyData(this.freq);

    this.bass = this.bandAvg(20, 160);
    this.mid = this.bandAvg(160, 2000);
    this.high = this.bandAvg(2000, 8000);
    this.level = this.bandAvg(20, 8000);

    // spectral flux over the rhythmically informative range
    const lo = Math.floor(20 / this.binHz);
    const hi = Math.min(this.freq.length - 1, Math.ceil(4000 / this.binHz));
    let flux = 0;
    for (let i = lo; i <= hi; i++) {
      const d = this.freq[i] - this.prevFreq[i];
      if (d > 0) flux += d;
    }
    this.flux = flux / ((hi - lo + 1) * 255);
  }
}
