export interface ColumnPreset {
  id: string;
  label: string;
  pcts: number[];
}

/** Width mixes for 2–4 columns. Applying a preset is additive: existing slot content is kept or merged. */
export const COLUMN_PRESETS: ColumnPreset[] = [
  { id: "50-50", label: "50% · 50%", pcts: [50, 50] },
  { id: "30-70", label: "30% · 70%", pcts: [30, 70] },
  { id: "70-30", label: "70% · 30%", pcts: [70, 30] },
  { id: "25-75", label: "25% · 75%", pcts: [25, 75] },
  { id: "75-25", label: "75% · 25%", pcts: [75, 25] },
  { id: "33-33-33", label: "33% · 33% · 33%", pcts: [34, 33, 33] },
  { id: "25-50-25", label: "25% · 50% · 25%", pcts: [25, 50, 25] },
  { id: "50-25-25", label: "50% · 25% · 25%", pcts: [50, 25, 25] },
  { id: "25-25-50", label: "25% · 25% · 50%", pcts: [25, 25, 50] },
  { id: "20-60-20", label: "20% · 60% · 20%", pcts: [20, 60, 20] },
  { id: "25-25-25-25", label: "25% · 25% · 25% · 25%", pcts: [25, 25, 25, 25] },
  { id: "40-20-40", label: "40% · 20% · 40%", pcts: [40, 20, 40] },
];

export function presetById(id: string): ColumnPreset | undefined {
  return COLUMN_PRESETS.find((p) => p.id === id);
}
