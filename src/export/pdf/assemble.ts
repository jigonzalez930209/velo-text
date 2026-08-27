import type { Clock, PortableDocument } from "../../core/model/types.js";
import type { DecodedImage } from "./image.js";
import { pdfEscape, type PdfPage } from "./pdf-model.js";
import { pageContentStream } from "./stream.js";

export function assemblePdf(
    pages: PdfPage[],
    doc: PortableDocument,
    assets: Record<string, { id: string; mediaType: string; data: Uint8Array }>,
    decoded: Map<string, DecodedImage | null>,
    clock: Clock,
  ): Uint8Array {
    const objects: string[] = [];
    const addObj = (content: string): number => {
      objects.push(content);
      return objects.length;
    };

    addObj(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
    objects.push(null as unknown as string); // Pages placeholder (2 0 obj)
    addObj(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
    const symbolNum = addObj(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>\nendobj`);

    // Image XObjects
    const imageObjects = new Map<string, number>();
    for (const [id, ref] of Object.entries(assets)) {
      const img = decoded.get(id);
      if (!img) continue;
      if (img.jpeg) {
        imageObjects.set(id, addObj(`${objects.length + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.widthPx} /Height ${img.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>\nstream\n${new TextDecoder("latin1").decode(img.jpeg)}\nendstream\nendobj`));
      } else if (img.rgb) {
        imageObjects.set(id, addObj(`${objects.length + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.widthPx} /Height ${img.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${img.rgb.length} >>\nstream\n${new TextDecoder("latin1").decode(img.rgb)}\nendstream\nendobj`));
      }
    }

    const xObjRes = imageObjects.size
      ? `/XObject << ${[...imageObjects.entries()].map(([k, n]) => `/Im${k.replace(/[^A-Za-z0-9]/g, "_")} ${n} 0 R`).join(" ")} >> `
      : "";

    // Content streams per page
    for (const page of pages) {
      const { stream } = pageContentStream(page, doc, imageObjects);
      const contentNum = objects.length + 1;
      const bytesLen = new TextEncoder().encode(stream).length;
      addObj(`${contentNum} 0 obj\n<< /Length ${bytesLen} >>\nstream\n${stream}\nendstream\nendobj`);
      const pageNum = objects.length + 1;
      addObj(`${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentNum} 0 R /Resources << /Font << /F1 3 0 R /F2 ${symbolNum} 0 R >> ${xObjRes}>> >>\nendobj`);
      (page as { objNum?: number }).objNum = pageNum;
    }

    const kids = pages.map((p) => `${p.objNum} 0 R`).join(" ");
    objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj`;

    const infoNum = objects.length + 1;
    const now = clock.nowIso();
    const title = (doc.metadata?.title as string | undefined) ?? "Portable Document";
    addObj(`${infoNum} 0 obj\n<< /Title (${pdfEscape(title)}) /Creator (portable-doc-editor) /CreationDate (D:${now.replace(/[-:T]/g, "").slice(0, 14)}) >>\nendobj`);

    let pdf = "%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n";
    const objOffsets: number[] = [];
    for (const objStr of objects) {
      objOffsets.push(pdf.length);
      pdf += objStr + "\n";
    }
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of objOffsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoNum} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new TextEncoder().encode(pdf);
  }
