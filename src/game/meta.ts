/** Permanent scrap-bought upgrade tracks. Tier state lives in SaveData.meta. */

export type MetaTrackId = "plating" | "salvage" | "boost" | "groove";

export interface MetaTrack {
  id: MetaTrackId;
  name: string;
  maxTier: number;
  baseCost: number;
  /** human line for the per-tier effect */
  effect: string;
}

export const META_TRACKS: MetaTrack[] = [
  { id: "plating", name: "HULL PLATING", maxTier: 5, baseCost: 100, effect: "+10 max hull / tier" },
  { id: "salvage", name: "SALVAGE RIG", maxTier: 5, baseCost: 120, effect: "+10% scrap / tier" },
  { id: "boost", name: "BOOST TUNING", maxTier: 5, baseCost: 150, effect: "+8% gate boost / tier" },
  { id: "groove", name: "GROOVE SYNC", maxTier: 3, baseCost: 200, effect: "+10ms beat window / tier" },
];

export function tierCost(track: MetaTrack, currentTier: number): number {
  return Math.round(track.baseCost * Math.pow(1.9, currentTier));
}
