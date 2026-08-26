import type { MetaTrackId } from "../game/meta";

export interface SaveData {
  scrap: number;
  bestScore: number;
  totalRuns: number;
  ownedShips: string[];
  selectedShip: string;
  meta: Record<MetaTrackId, number>; // upgrade tiers
}

const KEY = "fzero-save-v1";

const DEFAULTS: SaveData = {
  scrap: 0,
  bestScore: 0,
  totalRuns: 0,
  ownedShips: ["stinger"],
  selectedShip: "stinger",
  meta: { plating: 0, salvage: 0, boost: 0, groove: 0 },
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return {
        ...DEFAULTS,
        ...parsed,
        ownedShips: parsed.ownedShips?.length ? parsed.ownedShips : [...DEFAULTS.ownedShips],
        meta: { ...DEFAULTS.meta, ...(parsed.meta ?? {}) },
      };
    }
  } catch {
    // corrupted save → fresh start
  }
  return { ...DEFAULTS, ownedShips: [...DEFAULTS.ownedShips], meta: { ...DEFAULTS.meta } };
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
