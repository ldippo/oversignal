export interface SectorTheme {
  name: string;
  edgeLeft: number;
  edgeRight: number;
  fog: number;
  background: number;
  gate: number;
  obstacle: number;
  scrap: number;
  skyHorizon: number;
  skyZenith: number;
  celestial: number; // big body silhouette color
  celestialDir: [number, number, number]; // direction from ship, normalized-ish
}

export const SECTOR_THEMES: SectorTheme[] = [
  {
    name: "NEON STRAIT",
    edgeLeft: 0x4ef3ff, edgeRight: 0xff3ec8, fog: 0x050514, background: 0x030308,
    gate: 0x4ef3ff, obstacle: 0xff4a3e, scrap: 0xffc44e,
    skyHorizon: 0x0e1440, skyZenith: 0x020208, celestial: 0x8a4eff, celestialDir: [0.45, 0.28, -0.85],
  },
  {
    name: "EMBER FIELD",
    edgeLeft: 0xffc44e, edgeRight: 0xff5a3e, fog: 0x140805, background: 0x080303,
    gate: 0xffa94e, obstacle: 0xff3e6a, scrap: 0x8aff6a,
    skyHorizon: 0x3a1206, skyZenith: 0x0a0202, celestial: 0xff7a2e, celestialDir: [-0.5, 0.22, -0.8],
  },
  {
    name: "VIOLET DEEP",
    edgeLeft: 0xb04eff, edgeRight: 0x4e6aff, fog: 0x0a0514, background: 0x050308,
    gate: 0xc44eff, obstacle: 0xff4a3e, scrap: 0x4ef3ff,
    skyHorizon: 0x1c0a3a, skyZenith: 0x030110, celestial: 0x4e9aff, celestialDir: [0.15, 0.42, -0.9],
  },
  {
    name: "ACID RUN",
    edgeLeft: 0x8aff6a, edgeRight: 0x4ef3ff, fog: 0x051408, background: 0x030805,
    gate: 0x8aff6a, obstacle: 0xff8a3e, scrap: 0xff3ec8,
    skyHorizon: 0x0a2e14, skyZenith: 0x010804, celestial: 0xd4ff4e, celestialDir: [-0.35, 0.35, -0.85],
  },
];

export function themeFor(segmentIndex: number): SectorTheme {
  return SECTOR_THEMES[segmentIndex % SECTOR_THEMES.length];
}
