/**
 * Standard PDF fonts (Phase 7.1.3 v1): Helvetica family / Symbol, WinAnsi.
 * Embedding licensed TTF is out of this package (no font files, no cmap builder).
 */
export const PDF_BASE_FONTS = ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique", "Symbol"] as const;

export type PdfFace = "F1" | "F3" | "F4" | "F5";

export function pdfFaceForMarks(bold?: boolean, italic?: boolean): PdfFace {
  if (bold && italic) return "F5";
  if (bold) return "F4";
  if (italic) return "F3";
  return "F1";
}

export function pdfFontForMarks(bold?: boolean, italic?: boolean): string {
  const face = pdfFaceForMarks(bold, italic);
  if (face === "F4") return "Helvetica-Bold";
  if (face === "F3") return "Helvetica-Oblique";
  if (face === "F5") return "Helvetica-BoldOblique";
  return "Helvetica";
}
