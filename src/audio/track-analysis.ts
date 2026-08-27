/**
 * Offline full-track analysis for the decoded-track conductor. Knowing every
 * beat in advance beats live prediction on every axis: exact on-beat windows,
 * drops that land on the actual drop, energy that matches the arrangement.
 *
 * Pipeline: mono mix → bass/total energy envelopes (512-sample hops) →
 * log-diff onset strength → autocorrelation tempo (60–200 BPM, harmonic
 * scoring) → grid phase by onset alignment → coarse energy/bass curves →
 * drop detection on the energy curve.
 */

export interface TrackAnalysis {
  duration: number;
  bpm: number;
  beats: Float32Array; // beat timestamps in seconds
  /** normalized 0..1, one sample per CURVE_DT seconds */
  energy: Float32Array;
  bass: Float32Array;
  drops: { start: number; end: number }[];
  /** refinement diagnostics (dev) */
  debug?: { coarseBpm: number; passes: { snapped: number; slope: number; accepted: boolean }[] };
}

export const CURVE_DT = 0.25;
const HOP = 512;

export function analyzeBuffer(buf: AudioBuffer): TrackAnalysis {
  const sr = buf.sampleRate;
  const n = buf.length;
  const hopDur = HOP / sr;

  // mono mix
  const mono = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += ch[i];
  }
  const chScale = 1 / buf.numberOfChannels;

  // one-pole lowpass (~150Hz) for the bass envelope
  const a = 1 - Math.exp((-2 * Math.PI * 150) / sr);
  const hops = Math.floor(n / HOP);
  const bassE = new Float32Array(hops);
  const totalE = new Float32Array(hops);
  let lp = 0;
  for (let h = 0; h < hops; h++) {
    let be = 0;
    let te = 0;
    const off = h * HOP;
    for (let i = 0; i < HOP; i++) {
      const x = mono[off + i] * chScale;
      lp += a * (x - lp);
      be += lp * lp;
      te += x * x;
    }
    bassE[h] = be / HOP;
    totalE[h] = te / HOP;
  }

  // onset strength: positive log-energy diff, bass-weighted
  const onset = new Float32Array(hops);
  const EPS = 1e-8;
  for (let h = 1; h < hops; h++) {
    const db = Math.log(bassE[h] + EPS) - Math.log(bassE[h - 1] + EPS);
    const dt = Math.log(totalE[h] + EPS) - Math.log(totalE[h - 1] + EPS);
    onset[h] = Math.max(0, db) + 0.4 * Math.max(0, dt);
  }

  // tempo: autocorrelation over 60–200 BPM with harmonic support
  const minLag = Math.max(2, Math.floor(60 / 200 / hopDur));
  const maxLag = Math.min(hops >> 1, Math.ceil(60 / 60 / hopDur));
  let bestLag = Math.round(0.5 / hopDur); // default 120 BPM
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let h = 0; h + lag < hops; h++) s += onset[h] * onset[h + lag];
    s /= hops - lag;
    // reward lags whose double (half tempo) also correlates — true beat periods do
    const lag2 = lag * 2;
    if (lag2 <= maxLag) {
      let s2 = 0;
      for (let h = 0; h + lag2 < hops; h++) s2 += onset[h] * onset[h + lag2];
      s += 0.5 * (s2 / (hops - lag2));
    }
    // mild prior toward the 90-150 BPM sweet spot
    const bpm = 60 / (lag * hopDur);
    const prior = bpm > 85 && bpm < 155 ? 1.08 : 1;
    s *= prior;
    if (s > bestScore) {
      bestScore = s;
      bestLag = lag;
    }
  }
  const period = bestLag * hopDur;
  const bpm = 60 / period;

  // phase: offset (in hops) that maximizes onset mass on the grid
  let bestPhase = 0;
  let bestPhaseScore = -Infinity;
  for (let p = 0; p < bestLag; p++) {
    let s = 0;
    for (let h = p; h < hops; h += bestLag) s += onset[h];
    if (s > bestPhaseScore) {
      bestPhaseScore = s;
      bestPhase = p;
    }
  }

  const duration = n / sr;

  // refine period+phase past hop quantization: snap each coarse grid point to
  // its local onset peak, then least-squares fit the line beat_i = phase + i*T
  let refPeriod = period;
  let refPhase = bestPhase * hopDur;
  const passes: { snapped: number; slope: number; accepted: boolean }[] = [];
  {
    // onset peaks (local maxima, ≥ half a period apart, above the floor)
    const peaks: number[] = [];
    const minSep = Math.max(4, Math.floor(bestLag * 0.5));
    let lastPk = -minSep;
    for (let h = 1; h < hops - 1; h++) {
      if (onset[h] > 0.02 && onset[h] >= onset[h - 1] && onset[h] >= onset[h + 1] && h - lastPk >= minSep) {
        peaks.push(h * hopDur);
        lastPk = h;
      }
    }
    // progressive beat-index assignment against a RUNNING least-squares fit —
    // a fixed coarse grid slips indices mid-track; a walking fit never does
    if (peaks.length >= 8) {
      let P = period;
      let phi = peaks[0];
      let lastK = 0;
      let m = 1;
      let sx = 0, sy = peaks[0], sxx = 0, sxy = 0;
      for (let j = 1; j < peaks.length; j++) {
        const k = Math.round((peaks[j] - phi) / P);
        if (k <= lastK) continue; // duplicate / backwards
        if (Math.abs(peaks[j] - (phi + k * P)) > P * 0.3) continue; // off-grid onset
        lastK = k;
        m++;
        sx += k;
        sy += peaks[j];
        sxx += k * k;
        sxy += k * peaks[j];
        if (m >= 4) {
          const den = m * sxx - sx * sx;
          if (den > 0) {
            const s = (m * sxy - sx * sy) / den;
            if (Math.abs(s - period) < period * 0.12) {
              P = s;
              phi = (sy - s * sx) / m;
            }
          }
        }
      }
      const accepted = m >= 8 && Math.abs(P - period) < period * 0.12;
      passes.push({ snapped: m, slope: P, accepted });
      if (accepted) {
        refPeriod = P;
        // pull the anchor back to the start of the track
        refPhase = phi - Math.floor(phi / refPeriod) * refPeriod;
      }
    }
  }

  const beatCount = Math.max(1, Math.floor((duration - refPhase) / refPeriod));
  const beats = new Float32Array(beatCount);
  for (let i = 0; i < beatCount; i++) beats[i] = refPhase + i * refPeriod;

  // coarse curves (CURVE_DT cadence), normalized to the 95th percentile
  const curveLen = Math.max(1, Math.floor(duration / CURVE_DT));
  const hopsPerCurve = Math.max(1, Math.floor(CURVE_DT / hopDur));
  const energy = new Float32Array(curveLen);
  const bass = new Float32Array(curveLen);
  for (let i = 0; i < curveLen; i++) {
    let te = 0;
    let be = 0;
    const h0 = i * hopsPerCurve;
    const h1 = Math.min(hops, h0 + hopsPerCurve);
    for (let h = h0; h < h1; h++) {
      te += totalE[h];
      be += bassE[h];
    }
    energy[i] = Math.sqrt(te / Math.max(1, h1 - h0));
    bass[i] = Math.sqrt(be / Math.max(1, h1 - h0));
  }
  normalize(energy);
  normalize(bass);

  // drops: quiet stretch (≥3s under 0.45) breaking into loud (≥0.75)
  const drops: { start: number; end: number }[] = [];
  let quiet = 0;
  for (let i = 1; i < curveLen; i++) {
    if (energy[i] < 0.45) quiet += CURVE_DT;
    else {
      if (quiet >= 3 && energy[i] > 0.75 && drops.length < 8) {
        const start = i * CURVE_DT;
        let end = start;
        while (end < duration && energy[Math.min(curveLen - 1, Math.floor(end / CURVE_DT))] > 0.5) end += CURVE_DT;
        drops.push({ start, end: Math.min(end, start + 10) });
      }
      quiet = 0;
    }
  }

  return { duration, bpm: 60 / refPeriod, beats, energy, bass, drops, debug: { coarseBpm: bpm, passes } };
}

function normalize(arr: Float32Array): void {
  const sorted = [...arr].sort((x, y) => x - y);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
  if (p95 <= 0) return;
  for (let i = 0; i < arr.length; i++) arr[i] = Math.min(1, arr[i] / p95);
}
