export interface SectorTheme {
  name: string;
  edgeLeft: number;
  edgeRight: number;
  fog: number;
  background: number;
  gate: number;
  obstacle: number;
  scrap: number;
}

export const SECTOR_THEMES: SectorTheme[] = [
  { name: "NEON STRAIT", edgeLeft: 0x4ef3ff, edgeRight: 0xff3ec8, fog: 0x050514, background: 0x030308, gate: 0x4ef3ff, obstacle: 0xff4a3e, scrap: 0xffc44e },
  { name: "EMBER FIELD", edgeLeft: 0xffc44e, edgeRight: 0xff5a3e, fog: 0x140805, background: 0x080303, gate: 0xffa94e, obstacle: 0xff3e6a, scrap: 0x8aff6a },
  { name: "VIOLET DEEP", edgeLeft: 0xb04eff, edgeRight: 0x4e6aff, fog: 0x0a0514, background: 0x050308, gate: 0xc44eff, obstacle: 0xff4a3e, scrap: 0x4ef3ff },
  { name: "ACID RUN", edgeLeft: 0x8aff6a, edgeRight: 0x4ef3ff, fog: 0x051408, background: 0x030805, gate: 0x8aff6a, obstacle: 0xff8a3e, scrap: 0xff3ec8 },
];

export function themeFor(segmentIndex: number): SectorTheme {
  return SECTOR_THEMES[segmentIndex % SECTOR_THEMES.length];
}
