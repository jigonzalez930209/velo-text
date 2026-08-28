export interface ColumnPreset {
  id: string;
  label: string;
  pcts: number[];
}

/** Four common mixes: halves, 70/30, thirds, quarters. */
export const COLUMN_PRESETS: ColumnPreset[] = [
  { id: "50-50", label: "50% · 50%", pcts: [50, 50] },
  { id: "70-30", label: "70% · 30%", pcts: [70, 30] },
  { id: "33-33-33", label: "33% · 33% · 33%", pcts: [34, 33, 33] },
  { id: "25-25-25-25", label: "25% · 25% · 25% · 25%", pcts: [25, 25, 25, 25] },
];

export function presetById(id: string): ColumnPreset | undefined {
  return COLUMN_PRESETS.find((p) => p.id === id);
}
