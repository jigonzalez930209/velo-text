/**
 * Word-like Office theme + standard palette. User-chosen text, highlight, and
 * cell fills snap to these hexes so editor HTML and PDF share one token set.
 */
export const OFFICE_THEME: readonly (readonly string[])[] = [
  ["#ffffff", "#000000", "#e7e6e6", "#44546a", "#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47"],
  ["#f2f2f2", "#7f7f7f", "#d0cece", "#d6dce4", "#d9e2f3", "#fbe5d6", "#ededed", "#fff2cc", "#deebf7", "#e2efd9"],
  ["#d9d9d9", "#595959", "#aeabab", "#adb9ca", "#b4c6e7", "#f8cbad", "#c9c9c9", "#ffe699", "#bdd7ee", "#c5e0b3"],
  ["#bfbfbf", "#3f3f3f", "#757070", "#8497b0", "#8faadc", "#f4b183", "#a6a6a6", "#ffd966", "#9dc3e6", "#a9d08e"],
  ["#a6a6a6", "#262626", "#3a3838", "#323f4f", "#2f5496", "#c55a11", "#7b7b7b", "#bf8f00", "#2e75b6", "#548235"],
  ["#808080", "#0d0d0d", "#171616", "#222b35", "#203864", "#833c0c", "#525252", "#806000", "#1f4e79", "#375623"],
];

export const OFFICE_STANDARD: readonly string[] = [
  "#c00000", "#ff0000", "#ffc000", "#ffff00", "#92d050", "#00b050", "#00b0f0", "#0070c0", "#002060", "#7030a0",
];

export const OFFICE_STANDARD_LABEL = "Colores estándar";

const ALL: string[] = [
  ...OFFICE_THEME.flat(),
  ...OFFICE_STANDARD,
];

export function cssToHex6(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const c = color.trim().toLowerCase();
  if (c.startsWith("#")) {
    const h = c.slice(1);
    if (h.length === 3 && /^[0-9a-f]{3}$/.test(h)) return `#${h.split("").map((ch) => ch + ch).join("")}`;
    if (h.length >= 6 && /^[0-9a-f]{6}/.test(h)) return `#${h.slice(0, 6)}`;
    return undefined;
  }
  const m = c.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (!m) return undefined;
  return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
}

function dist2(a: string, b: string): number {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const dr = ((pa >> 16) & 255) - ((pb >> 16) & 255);
  const dg = ((pa >> 8) & 255) - ((pb >> 8) & 255);
  const db = (pa & 255) - (pb & 255);
  return dr * dr + dg * dg + db * db;
}

/** Nearest palette hex; default black. Always `#rrggbb`. */
export function snapOfficeHex(color: string | undefined): string {
  const hex = cssToHex6(color);
  if (!hex) return "#000000";
  let best = ALL[0]!;
  let bestD = Infinity;
  for (const p of ALL) {
    if (p === hex) return p;
    const d = dist2(hex, p);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function isOfficeHex(color: string | undefined): boolean {
  const hex = cssToHex6(color);
  return !!hex && ALL.includes(hex);
}
