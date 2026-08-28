/**
 * Standard PDF fonts (Phase 7.1.3 v1): Helvetica / Symbol, WinAnsi.
 * Embedding licensed TTF is out of this package (no font files, no cmap builder).
 */
export const PDF_BASE_FONTS = ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Symbol"] as const;

export function pdfFontForMarks(bold?: boolean, italic?: boolean): string {
  if (bold && italic) return "Helvetica-Bold";
  if (bold) return "Helvetica-Bold";
  if (italic) return "Helvetica-Oblique";
  return "Helvetica";
}
