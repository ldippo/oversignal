export interface SaveData {
  scrap: number;
  bestScore: number;
  totalRuns: number;
}

const KEY = "fzero-save-v1";

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { scrap: 0, bestScore: 0, totalRuns: 0, ...JSON.parse(raw) };
  } catch {
    // corrupted save → fresh start
  }
  return { scrap: 0, bestScore: 0, totalRuns: 0 };
}

export function persistSave(data: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function bankRun(data: SaveData, payout: number, score: number): SaveData {
  data.scrap += payout;
  data.bestScore = Math.max(data.bestScore, Math.floor(score));
  data.totalRuns += 1;
  persistSave(data);
  return data;
}
