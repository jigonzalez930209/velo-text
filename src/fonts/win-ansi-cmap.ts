import { PDF_WINANSI_FIRST, PDF_WINANSI_LAST, winAnsiToUnicode } from "./win-ansi.js";

function hexByte(n: number): string {
  return n.toString(16).padStart(2, "0");
}

function hexUnicode(n: number): string {
  return n.toString(16).padStart(4, "0");
}

/** ToUnicode CMap stream for embedded TrueType + WinAnsiEncoding (Chrome-safe). */
export function winAnsiToUnicodeCMapStream(): string {
  const bfchar: string[] = [];
  for (let b = 128; b <= 159; b++) {
    const u = winAnsiToUnicode(b);
    if (u >= 32) bfchar.push(`<${hexByte(b)}> <${hexUnicode(u)}>`);
  }
  const lines = [
    "/CIDInit /ProcSet findresource begin",
    "12 dict begin",
    "begincmap",
    "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
    "/CMapName /Adobe-Identity-UCS def",
    "/CMapType 2 def",
    "1 begincodespacerange",
    `<${hexByte(PDF_WINANSI_FIRST)}> <${hexByte(PDF_WINANSI_LAST)}>`,
    "endcodespacerange",
    "2 beginbfrange",
    `<${hexByte(32)}> <${hexByte(126)}> <${hexUnicode(32)}>`,
    `<${hexByte(160)}> <${hexByte(255)}> <${hexUnicode(160)}>`,
    "endbfrange",
  ];
  if (bfchar.length) {
    lines.push(`${bfchar.length} beginbfchar`, ...bfchar, "endbfchar");
  }
  lines.push(
    "endcmap",
    "CMapName currentdict /CMap defineresource pop",
    "end",
    "end",
  );
  return lines.join("\n");
}
