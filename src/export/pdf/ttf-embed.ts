import {
  documentFontByFace,
  pdfBaseFontForFace,
  weightForFace,
  type PdfDocFace,
} from "../../fonts/catalog.js";
import { documentFontBytes } from "../../fonts/index.js";
import { pdfWidths1000 } from "../../fonts/ttf-metrics.js";

export function pdfTrueTypeObjects(
  enc: (s: string) => Uint8Array,
  concat: (p: Uint8Array[]) => Uint8Array,
  firstNum: number,
  used: Set<PdfDocFace>,
): { bodies: Uint8Array[]; faces: Partial<Record<PdfDocFace, number>> } {
  const bodies: Uint8Array[] = [];
  const faces: Partial<Record<PdfDocFace, number>> = {};
  let num = firstNum;
  for (const face of used) {
    const fontMeta = documentFontByFace(face);
    const baseFont = pdfBaseFontForFace(face);
    if (!fontMeta || !baseFont) continue;
    const weight = weightForFace(face);
    const ttf = documentFontBytes(fontMeta.id, weight);
    const widths = pdfWidths1000(ttf);
    const italic = weight === "italic" || weight === "boldItalic";
    const fileNum = num;
    const descNum = num + 1;
    const fontNum = num + 2;
    bodies.push(concat([
      enc(`${fileNum} 0 obj\n<< /Length ${ttf.length} /Length1 ${ttf.length} >>\nstream\n`),
      ttf,
      enc("\nendstream\nendobj"),
    ]));
    bodies.push(enc(
      `${descNum} 0 obj\n<< /Type /FontDescriptor /FontName /${baseFont} /Flags ${italic ? 96 : 32} /FontBBox [0 -200 1000 800] /ItalicAngle ${italic ? -12 : 0} /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 /FontFile2 ${fileNum} 0 R >>\nendobj`,
    ));
    bodies.push(enc(
      `${fontNum} 0 obj\n<< /Type /Font /Subtype /TrueType /BaseFont /${baseFont} /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 126 /Widths [${widths.join(" ")}] /FontDescriptor ${descNum} 0 R >>\nendobj`,
    ));
    faces[face] = fontNum;
    num += 3;
  }
  return { bodies, faces };
}
