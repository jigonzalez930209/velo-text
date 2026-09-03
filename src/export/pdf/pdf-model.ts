import { mapCharToPdfWinAnsi } from "../../fonts/win-ansi.js";
import type { MathBox } from "./equation.js";
import type { PdfFace } from "./fonts.js";

/** Escape PDF literal strings as WinAnsi bytes (not UTF-8 mojibake). */
export function pdfEscape(str: string): string {
  let out = "";
  for (const ch of str.normalize("NFC")) {
    const b = mapCharToPdfWinAnsi(ch);
    if (b === null) continue;
    if (b === 0x5c) { out += "\\\\"; continue; }
    if (b === 0x28) { out += "\\("; continue; }
    if (b === 0x29) { out += "\\)"; continue; }
    if (b < 128) { out += String.fromCharCode(b); continue; }
    out += `\\${b.toString(8).padStart(3, "0")}`;
  }
  return out;
}

/** UTF-16BE hex string for Identity-H embedded fonts (Chrome-safe Unicode). */
export function pdfUtf16Hex(str: string): string {
  let hex = "<";
  for (const ch of str.normalize("NFC")) {
    const cp = ch.codePointAt(0) ?? 0x3f;
    if (cp <= 0xffff) hex += cp.toString(16).padStart(4, "0");
    else {
      const adj = cp - 0x10000;
      hex += (0xd800 + (adj >> 10)).toString(16).padStart(4, "0");
      hex += (0xdc00 + (adj & 0x3ff)).toString(16).padStart(4, "0");
    }
  }
  return `${hex}>`;
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
  marginRightPt?: number;
  objNum?: number;
}

export interface PdfWriteResult {
  byteLength: number;
  pages: number;
}
