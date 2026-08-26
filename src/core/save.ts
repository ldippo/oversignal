import { META_TRACKS, tierCost, type MetaTrackId } from "../game/meta";
import type { DailyResult } from "../game/daily";

export interface Settings {
  sfxVolume: number; // 0..1
  screenShake: boolean;
  flashes: boolean; // photosensitivity: damage vignette, rail strobe, warp flash
  latencyMs: number; // beat-grid offset, −200..200
}

export interface SaveData {
  v: number;
  scrap: number;
  bestScore: number;
  totalRuns: number;
  ownedShips: string[];
  selectedShip: string;
  ownedModules: string[];
  loadouts: Record<string, string[]>; // shipId -> socketed module ids
  daily: DailyResult | null; // today's (or last played) daily run
  settings: Settings;
  seenTips: string[]; // one-shot onboarding callouts already shown
}

const KEY = "fzero-save-v1";

const DEFAULTS: SaveData = {
  v: 3,
  scrap: 0,
  bestScore: 0,
  totalRuns: 0,
  ownedShips: ["stinger"],
  selectedShip: "stinger",
  ownedModules: [],
  loadouts: {},
  daily: null,
  settings: { sfxVolume: 0.5, screenShake: true, flashes: true, latencyMs: 0 },
  seenTips: [],
};

interface LegacySave extends Partial<SaveData> {
  meta?: Record<MetaTrackId, number>;
}

/** v2 linear-track spend, refunded in full on migration to modules. */
function legacyRefund(meta: Record<MetaTrackId, number>): number {
  let refund = 0;
  for (const track of META_TRACKS) {
    const tiers = meta[track.id] ?? 0;
    for (let t = 0; t < tiers; t++) refund += tierCost(track, t);
  }
  return refund;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LegacySave;
      const save: SaveData = {
        ...DEFAULTS,
        ...parsed,
        v: 3,
        ownedShips: parsed.ownedShips?.length ? parsed.ownedShips : [...DEFAULTS.ownedShips],
        ownedModules: parsed.ownedModules ?? [],
        loadouts: parsed.loadouts ?? {},
        settings: { ...DEFAULTS.settings, ...(parsed.settings ?? {}) },
        seenTips: parsed.seenTips ?? [],
      };
      if (parsed.meta) {
        save.scrap += legacyRefund(parsed.meta);
        delete (save as LegacySave).meta;
        persistSave(save);
      }
      return save;
    }
  } catch {
    // corrupted save → fresh start
  }
  return {
    ...DEFAULTS,
    ownedShips: [...DEFAULTS.ownedShips],
    ownedModules: [],
    loadouts: {},
    settings: { ...DEFAULTS.settings },
    seenTips: [],
  };
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
