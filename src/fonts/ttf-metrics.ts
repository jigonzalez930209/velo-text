import {
  PDF_WINANSI_FIRST,
  PDF_WINANSI_LAST,
  mapCharToPdfWinAnsi,
  winAnsiToUnicode,
} from "./win-ansi.js";

/** Minimal TTF cmap format-4 + hmtx parser for WinAnsi widths (32–255). */

function u16(buf: Uint8Array, off: number): number {
  return (buf[off]! << 8) | buf[off + 1]!;
}
function s16(buf: Uint8Array, off: number): number {
  const v = u16(buf, off);
  return v > 32767 ? v - 65536 : v;
}
function u32(buf: Uint8Array, off: number): number {
  return ((buf[off]! << 24) | (buf[off + 1]! << 16) | (buf[off + 2]! << 8) | buf[off + 3]!) >>> 0;
}

function tableOffset(buf: Uint8Array, tag: string): number {
  const n = u16(buf, 4);
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    if (String.fromCharCode(buf[o]!, buf[o + 1]!, buf[o + 2]!, buf[o + 3]!) === tag) return u32(buf, o + 8);
  }
  return -1;
}

function cmapGlyph(buf: Uint8Array, cp: number): number {
  const base = tableOffset(buf, "cmap");
  if (base < 0) return 0;
  const nSub = u16(buf, base + 2);
  let subOff = -1;
  for (let i = 0; i < nSub; i++) {
    const o = base + 4 + i * 8;
    if (u16(buf, o) === 3 && u16(buf, o + 2) === 1) { subOff = u32(buf, o + 4); break; }
  }
  if (subOff < 0) {
    for (let i = 0; i < nSub; i++) {
      const o = base + 4 + i * 8;
      if (u16(buf, o + 2) === 1) { subOff = u32(buf, o + 4); break; }
    }
  }
  if (subOff < 0) return 0;
  const fmt = u16(buf, base + subOff);
  if (fmt !== 4) return 0;
  const seg = u16(buf, base + subOff + 6) / 2;
  const endOff = base + subOff + 14;
  // Format 4 layout: endCount[seg], uint16 reservedPad (0), startCount[seg], …
  const startOff = endOff + seg * 2 + 2;
  const deltaOff = startOff + seg * 2;
  const rangeOff = deltaOff + seg * 2;
  const glyphOff = rangeOff + seg * 2;
  for (let i = 0; i < seg; i++) {
    const end = u16(buf, endOff + i * 2);
    const start = u16(buf, startOff + i * 2);
    if (cp < start || cp > end) continue;
    const delta = s16(buf, deltaOff + i * 2);
    const ro = u16(buf, rangeOff + i * 2);
    if (ro === 0) return (cp + delta) & 65535;
    const idx = ro / 2 + (cp - start) - (seg - i);
    const g = u16(buf, glyphOff + idx * 2);
    return g === 0 ? 0 : (g + delta) & 65535;
  }
  return 0;
}

function glyphAdvance(buf: Uint8Array, cp: number): number {
  const maxp = tableOffset(buf, "maxp");
  const hhea = tableOffset(buf, "hhea");
  const hmtx = tableOffset(buf, "hmtx");
  const numGlyphs = maxp >= 0 ? u16(buf, maxp + 4) : 0;
  const longMetrics = hhea >= 0 ? u16(buf, hhea + 34) : numGlyphs;
  const gid = cmapGlyph(buf, cp);
  if (gid < longMetrics && hmtx >= 0) return u16(buf, hmtx + gid * 4);
  if (longMetrics > 0 && hmtx >= 0) return u16(buf, hmtx + (longMetrics - 1) * 4);
  return 600;
}

function advance1000(buf: Uint8Array, cp: number, unitsPerEm: number): number {
  return Math.round(glyphAdvance(buf, cp) * 1000 / unitsPerEm);
}

export interface TtfMetrics {
  /** advance widths per WinAnsi char code 32–255 */
  widths: number[];
  unitsPerEm: number;
}

const cache = new WeakMap<Uint8Array, TtfMetrics>();

export function parseTtfMetrics(buf: Uint8Array): TtfMetrics {
  let m = cache.get(buf);
  if (m) return m;
  const head = tableOffset(buf, "head");
  const unitsPerEm = head >= 0 ? u16(buf, head + 18) : 1000;
  const widths: number[] = [];
  for (let byte = PDF_WINANSI_FIRST; byte <= PDF_WINANSI_LAST; byte++) {
    widths.push(glyphAdvance(buf, winAnsiToUnicode(byte)));
  }
  m = { widths, unitsPerEm };
  cache.set(buf, m);
  return m;
}

export function ttfCharWidth(buf: Uint8Array, ch: string, sizePt: number): number {
  const byte = mapCharToPdfWinAnsi(ch);
  if (byte === null) return 0;
  const idx = byte >= PDF_WINANSI_FIRST && byte <= PDF_WINANSI_LAST ? byte - PDF_WINANSI_FIRST : -1;
  const { widths, unitsPerEm } = parseTtfMetrics(buf);
  const adv = idx >= 0 ? widths[idx]! : widths[11] ?? 600; // 'I' fallback
  return adv * sizePt / unitsPerEm;
}

export function ttfTextWidth(buf: Uint8Array, text: string, sizePt: number): number {
  let w = 0;
  for (const ch of text) w += ttfCharWidth(buf, ch, sizePt);
  return w;
}

/** PDF CIDFont /W array for Identity-H (ASCII + Latin-1). */
export function pdfCidWArray(buf: Uint8Array): string {
  const head = tableOffset(buf, "head");
  const unitsPerEm = head >= 0 ? u16(buf, head + 18) : 1000;
  const ascii: number[] = [];
  for (let cp = 32; cp <= 126; cp++) ascii.push(advance1000(buf, cp, unitsPerEm));
  const latin: number[] = [];
  for (let cp = 160; cp <= 255; cp++) latin.push(advance1000(buf, cp, unitsPerEm));
  return `32 [${ascii.join(" ")}] 160 [${latin.join(" ")}]`;
}

/** PDF TrueType /Widths entries are in thousandths of the text space (not font units). */
export function pdfWidths1000(buf: Uint8Array): number[] {
  const { widths, unitsPerEm } = parseTtfMetrics(buf);
  return widths.map((w) => Math.round(w * 1000 / unitsPerEm));
}
