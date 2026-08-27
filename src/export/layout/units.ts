/**
 * Layout units — Phase 6.1.1
 * Conversion between px, pt, twip, EMU and internal micrometers.
 * Uses integer arithmetic where feasible; rounding is specified and tested at boundaries.
 *
 * Reference:
 * - 1 inch = 25.4 mm = 25,400 µm
 * - 1 pt = 1/72 inch = 352.777... µm
 * - 1 twip = 1/1440 inch = 17.638... µm
 * - 1 EMU = 1/914400 inch = 0.02777... µm (914400 EMU per inch)
 * - 1 px at 96 DPI = 1/96 inch = 264.583... µm
 */

// Internal canonical: micrometers (integer)
export const UM_PER_INCH = 25_400;
export const UM_PER_MM = 1_000;
export const UM_PER_PT = 25_400 / 72; // 352.777...
export const UM_PER_TWIP = 25_400 / 1440; // 17.638...
export const UM_PER_EMU = 25_400 / 914_400; // ~0.02777
export const UM_PER_PX_AT_96DPI = 25_400 / 96; // 264.583...

export function ptToUm(pt: number): number {
  return Math.round(pt * UM_PER_PT);
}
export function umToPt(um: number): number {
  return um / UM_PER_PT;
}
export function pxToUm(px: number, dpi = 96): number {
  return Math.round((px * UM_PER_INCH) / dpi);
}
export function umToPx(um: number, dpi = 96): number {
  return (um * dpi) / UM_PER_INCH;
}
export function twipToUm(twip: number): number {
  return Math.round(twip * UM_PER_TWIP);
}
export function umToTwip(um: number): number {
  return Math.round(um / UM_PER_TWIP);
}
export function emuToUm(emu: number): number {
  return Math.round(emu * UM_PER_EMU);
}
export function umToEmu(um: number): number {
  return Math.round(um / UM_PER_EMU);
}
export function mmToUm(mm: number): number {
  return Math.round(mm * UM_PER_MM);
}

// Rounding helpers with specified behavior (round half away from zero via Math.round)
export function roundUm(value: number): number {
  return Math.round(value);
}

// Edge tests: ensure 0 stays 0, negative is handled (though layout should not use negatives)
export function clampUm(value: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
