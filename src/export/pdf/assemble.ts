import type { Clock, PortableDocument } from "../../core/model/types.js";
import type { DecodedImage } from "./image.js";
import { pdfEscape, type PdfPage } from "./pdf-model.js";
import { pageContentStream } from "./stream.js";

const enc = new TextEncoder();

function u8(s: string): Uint8Array {
  return enc.encode(s);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function imageXObject(num: number, img: DecodedImage): Uint8Array | null {
  if (img.jpeg && img.widthPx && img.heightPx) {
    const dict = `<< /Type /XObject /Subtype /Image /Width ${img.widthPx} /Height ${img.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>`;
    return concat([u8(`${num} 0 obj\n${dict}\nstream\n`), img.jpeg, u8("\nendstream\nendobj")]);
  }
  if (img.rgb && img.widthPx && img.heightPx) {
    const dict = `<< /Type /XObject /Subtype /Image /Width ${img.widthPx} /Height ${img.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${img.rgb.length} >>`;
    return concat([u8(`${num} 0 obj\n${dict}\nstream\n`), img.rgb, u8("\nendstream\nendobj")]);
  }
  return null;
}

export function assemblePdf(
  pages: PdfPage[],
  doc: PortableDocument,
  assets: Record<string, { id: string; mediaType: string; data: Uint8Array }>,
  decoded: Map<string, DecodedImage | null>,
  clock: Clock,
): Uint8Array {
  const objects: Uint8Array[] = [];
  const addObj = (body: Uint8Array): number => {
    objects.push(body);
    return objects.length;
  };

  addObj(u8("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj"));
  objects.push(u8("")); // Pages placeholder (2 0 obj)
  addObj(u8("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"));
  const symbolNum = addObj(u8("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>\nendobj"));
  const obliqueNum = addObj(u8("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>\nendobj"));

  const imageObjects = new Map<string, number>();
  for (const [id, ref] of Object.entries(assets)) {
    void ref;
    const img = decoded.get(id);
    if (!img) continue;
    const num = objects.length + 1;
    const body = imageXObject(num, img);
    if (!body) continue;
    imageObjects.set(id, addObj(body));
  }

  const xObjRes = imageObjects.size
    ? `/XObject << ${[...imageObjects.entries()].map(([k, n]) => `/Im${k.replace(/[^A-Za-z0-9]/g, "_")} ${n} 0 R`).join(" ")} >> `
    : "";
  const fonts = `/Font << /F1 3 0 R /F2 ${symbolNum} 0 R /F3 ${obliqueNum} 0 R >>`;

  for (const page of pages) {
    const { stream } = pageContentStream(page, doc, imageObjects);
    const streamBytes = u8(stream);
    const contentNum = objects.length + 1;
    addObj(concat([
      u8(`${contentNum} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`),
      streamBytes,
      u8("\nendstream\nendobj"),
    ]));
    const pageNum = objects.length + 1;
    addObj(u8(`${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentNum} 0 R /Resources << ${fonts} ${xObjRes}>> >>\nendobj`));
    (page as { objNum?: number }).objNum = pageNum;
  }

  const kids = pages.map((p) => `${p.objNum} 0 R`).join(" ");
  objects[1] = u8(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj`);

  const infoNum = objects.length + 1;
  const now = clock.nowIso();
  const title = (doc.metadata?.title as string | undefined) ?? "Portable Document";
  addObj(u8(`${infoNum} 0 obj\n<< /Title (${pdfEscape(title)}) /Creator (portable-doc-editor) /CreationDate (D:${now.replace(/[-:T]/g, "").slice(0, 14)}) >>\nendobj`));

  const header = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);
  const parts: Uint8Array[] = [header];
  const objOffsets: number[] = [];
  let offset = header.length;
  for (const obj of objects) {
    objOffsets.push(offset);
    parts.push(obj, u8("\n"));
    offset += obj.length + 1;
  }
  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of objOffsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(u8(xref));
  return concat(parts);
}
