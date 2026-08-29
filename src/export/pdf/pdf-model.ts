import type { MathBox } from "./equation.js";
import type { PdfFace } from "./fonts.js";

/** Map Unicode to WinAnsi (Helvetica) octal so bullets are not UTF-8 mojibake. */
const WINANSI: Record<number, number> = {
  0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2026: 0x85, 0x20ac: 0x80, 0x00a0: 0x20,
};

export function pdfEscape(str: string): string {
  let out = "";
  for (const ch of String(str)) {
    if (ch === "\\" || ch === "(" || ch === ")") { out += `\\${ch}`; continue; }
    const cp = ch.codePointAt(0) ?? 63;
    if (cp < 128) { out += ch; continue; }
    const b = WINANSI[cp] ?? (cp < 256 ? cp : 0x3f);
    out += `\\${b.toString(8).padStart(3, "0")}`;
  }
  return out;
}

export type TextSegment = {
  kind: "text";
  text: string;
  sizePt: number;
  face?: PdfFace;
  color?: string;
  background?: string;
  underline?: boolean;
  strike?: boolean;
};

export type Segment =
  | TextSegment
  | { kind: "math"; math: MathBox; sizePt: number }
  | { kind: "rule"; widthPt: number };

export function copyTextSeg(s: TextSegment, text: string): TextSegment {
  return { ...s, text };
}

export interface PdfLine {
  segments: Segment[];
  yPt: number;
  sizePt: number;
  align: "left" | "center" | "right" | "justify";
  style: string;
}

export interface PdfPage {
  lines: Array<{ line: PdfLine; yPt: number }>;
  widthPt: number;
  heightPt: number;
  marginPt: number;
  objNum?: number;
}

export interface PdfWriteResult {
  byteLength: number;
  pages: number;
}
