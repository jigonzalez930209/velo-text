import type { MathBox } from "./equation.js";

export function pdfEscape(str: string): string {
  return String(str).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export type Segment =
  | { kind: "text"; text: string; sizePt: number }
  | { kind: "math"; math: MathBox; sizePt: number }
  | { kind: "rule"; widthPt: number };

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
