import {
  defaultDocumentFont,
  isDocumentPdfFace,
  pdfBaseFontForFace,
  pdfDocFaceForMarks,
  type PdfDocFace,
} from "../../fonts/catalog.js";

/** Standard-14 fallback for unknown families and math italics. */
export const PDF_BASE_FONTS = ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique", "Symbol"] as const;

export type PdfFace = "F1" | "F2" | "F3" | "F4" | "F5" | PdfDocFace;

export function pdfFaceForMarks(bold?: boolean, italic?: boolean, family?: string): PdfFace {
  const doc = pdfDocFaceForMarks(bold, italic, family);
  if (doc) return doc;
  if (family) {
    if (bold && italic) return "F5";
    if (bold) return "F4";
    if (italic) return "F3";
    return "F1";
  }
  return pdfDocFaceForMarks(bold, italic) ?? defaultDocumentFont().pdfFaceRegular;
}

export function pdfFontForMarks(bold?: boolean, italic?: boolean, family?: string): string {
  const face = pdfFaceForMarks(bold, italic, family);
  if (isDocumentPdfFace(face)) {
    return pdfBaseFontForFace(face) ?? defaultDocumentFont().pdfBaseFontRegular;
  }
  if (face === "F4") return "Helvetica-Bold";
  if (face === "F3") return "Helvetica-Oblique";
  if (face === "F5") return "Helvetica-BoldOblique";
  return "Helvetica";
}

export function collectDocumentFaces(faces: Iterable<PdfFace | undefined>): Set<PdfDocFace> {
  const out = new Set<PdfDocFace>();
  out.add("Fa");
  out.add("Fb");
  for (const f of faces) {
    if (f && isDocumentPdfFace(f)) out.add(f);
  }
  return out;
}
