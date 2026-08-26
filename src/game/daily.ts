import type { SaveData } from "../core/save";

export interface DailyResult {
  date: string; // UTC YYYY-MM-DD
  score: number;
  sector: number;
  bestCombo: number;
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Everyone racing the same UTC date races the same seed. */
export function dailySeed(date: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function playedToday(save: SaveData): boolean {
  return save.daily?.date === todayUTC();
}

export function shareText(daily: DailyResult): string {
  return [
    `OVERSIGNAL DAILY ${daily.date}`,
    `SCORE ${daily.score.toLocaleString()} · SECTOR ${daily.sector} · COMBO ×${daily.bestCombo}`,
    "https://oversignal.vercel.app",
  ].join("\n");
}
