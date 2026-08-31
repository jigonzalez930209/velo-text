/** PDF WinAnsiEncoding (ISO 32000 Table D.2): bytes 128–159 → Unicode. */
const WINANSI_HIGH: (number | null)[] = [
  0x20ac, null, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, null, 0x017d, null,
  null, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, null, 0x017e, 0x0178,
];

/** Unicode → WinAnsi for chars outside ASCII (bullets, dashes, Latin-1, etc.). */
const UNICODE_TO_WINANSI: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f, 0x00a0: 0x20,
};

/** Invisible / bidi controls — omit from PDF text (not replacement chars). */
const PDF_STRIP = new Set([
  0x000b, 0x000c, 0x000d, 0x00ad, 0x034f, 0x061c, 0x115f, 0x1160, 0x17b4, 0x17b5,
  0x180e, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d,
  0x202e, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0xfeff, 0xfff9, 0xfffa, 0xfffb,
]);

/** Common Unicode punctuation → nearest WinAnsi / ASCII equivalent. */
const PDF_FALLBACK: Record<number, number> = {
  0x0009: 0x20,
  0x2010: 0x2d, 0x2011: 0x2d, 0x2012: 0x96, 0x2015: 0x97, 0x2017: 0x5f,
  0x2032: 0x27, 0x2033: 0x22, 0x203d: 0x3f, 0x2044: 0x2f,
  0x2047: 0x3f, 0x2048: 0x3f, 0x2049: 0x3f,
  0x2212: 0x2d,
  0x03bc: 0xb5,
  0x20a1: 0x24, 0x20aa: 0x24, 0x20b1: 0x24, 0x20b9: 0x24,
  0x2116: 0x4e, 0x2120: 0x53,
  0xfb00: 0x66, 0xfb01: 0x66, 0xfb02: 0x66, 0xfb03: 0x66, 0xfb04: 0x66, 0xfb05: 0x73, 0xfb06: 0x73,
};

for (let i = 0; i < WINANSI_HIGH.length; i++) {
  const cp = WINANSI_HIGH[i];
  if (cp != null && UNICODE_TO_WINANSI[cp] === undefined) UNICODE_TO_WINANSI[cp] = 128 + i;
}

export const PDF_WINANSI_FIRST = 32;
export const PDF_WINANSI_LAST = 255;

/** WinAnsi byte → Unicode code point for TTF cmap lookup. */
export function winAnsiToUnicode(byte: number): number {
  if (byte >= 32 && byte <= 126) return byte;
  if (byte >= 128 && byte <= 159) return WINANSI_HIGH[byte - 128] ?? 0x20;
  if (byte >= 160 && byte <= 255) return byte;
  return 0x20;
}

/** Unicode code point → WinAnsi byte (0x3f when unmapped). */
export function unicodeToWinAnsi(cp: number): number {
  if (cp >= 32 && cp <= 126) return cp;
  const mapped = UNICODE_TO_WINANSI[cp];
  if (mapped !== undefined) return mapped;
  if (cp >= 160 && cp <= 255) return cp;
  return 0x3f;
}

/** Map one code point for PDF (null = omit from output stream). */
export function mapUnicodeToPdfWinAnsi(cp: number): number | null {
  if (PDF_STRIP.has(cp)) return null;
  if (cp >= 0x0300 && cp <= 0x036f) return null;
  const fb = PDF_FALLBACK[cp];
  if (fb !== undefined) return fb;
  return unicodeToWinAnsi(cp);
}

/** Map a string character to WinAnsi (null = omit). NFC-normalized. */
export function mapCharToPdfWinAnsi(ch: string): number | null {
  const cp = ch.normalize("NFC").codePointAt(0) ?? 0x3f;
  return mapUnicodeToPdfWinAnsi(cp);
}

/** Map a string character to its WinAnsi byte (NFC-normalized). Strips → space width via 0x20 skip handled in metrics. */
export function charToWinAnsi(ch: string): number {
  return mapCharToPdfWinAnsi(ch) ?? 0x20;
}

/** Characters that would render as "?" in PDF (after fallbacks and strips). */
export function findUnmappedPdfChars(text: string): string[] {
  const out: string[] = [];
  for (const ch of text.normalize("NFC")) {
    const cp = ch.codePointAt(0) ?? 0;
    const b = mapUnicodeToPdfWinAnsi(cp);
    if (b === null) continue;
    if (b === 0x3f && ch !== "?") out.push(ch);
  }
  return [...new Set(out)];
}
