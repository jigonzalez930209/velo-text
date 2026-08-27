/**
 * Minimal PdfWriter — Phase 7
 * Catalog, pages, streams, xref, deterministic trailer.
 */
import type { PortableDocument, BinarySink, Clock, IdGenerator } from "../../core/model/types.js";

function pdfEscape(str: string): string {
  return String(str).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

interface PdfPage {
  lines: Array<{ text: string; style: string; level?: number; y: number }>;
}

export interface PdfWriteResult {
  byteLength: number;
  pages: number;
}

export class PdfWriter {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(opts: { clock?: Clock; idGenerator?: IdGenerator } = {}) {
    this.clock = opts.clock ?? { nowIso: () => new Date().toISOString() };
    let c = 0;
    this.idGenerator = opts.idGenerator ?? { next: () => `pdf_${++c}` };
  }

  async write(layoutOrDoc: PortableDocument | { document: PortableDocument }, sink: BinarySink): Promise<PdfWriteResult> {
    const doc: PortableDocument = (layoutOrDoc as { document: PortableDocument }).document ?? (layoutOrDoc as PortableDocument);
    const pages = this.buildPages(doc);
    const pdfBytes = this.assemblePdf(pages, doc);
    await sink.write(pdfBytes);
    await sink.close?.();
    return { byteLength: pdfBytes.length, pages: pages.length };
  }

  private buildPages(doc: PortableDocument): PdfPage[] {
    const pageHeight = 800;
    const margin = 50;
    const lines: Array<{ text: string; style: string; level?: number }> = [];

    const collect = (blocks: PortableDocument["root"]["children"]): void => {
      for (const b of blocks) {
        if (b.type === "paragraph" || b.type === "heading" || b.type === "quote") {
          const text = (b.children ?? [])
            .map((c) => {
              if (c.type === "text") return c.text;
              if (c.type === "variable") return c.source;
              if (c.type === "equation") return `$${(c as unknown as { latex: string }).latex}$`;
              return "";
            })
            .join("");
          lines.push({ text, style: b.type, level: (b as { level?: number }).level });
        } else if (b.type === "table") {
          for (const row of b.rows) for (const cell of row.cells) collect(cell.blocks);
        } else if (b.type === "list") {
          for (const it of b.items)
            lines.push({
              text: `• ${it.content
                .map((c) => {
                  const cc = c as { text?: string; source?: string; latex?: string; type: string };
                  if (cc.type === "equation") return `$${cc.latex}$`;
                  return cc.text ?? cc.source ?? "";
                })
                .join("")}`,
              style: "list",
            });
        } else if (b.type === "horizontal-rule") lines.push({ text: "---", style: "hr" });
        else if (b.type === "page-break") lines.push({ text: "[PAGE_BREAK]", style: "break" });
        else if (b.type === "image") lines.push({ text: `[IMAGE ${(b as { assetId: string }).assetId}]`, style: "image" });
        else if (b.type === "equation-block")
          lines.push({ text: `$${(b as unknown as { latex: string }).latex}$`, style: "equation-block" });
      }
    };
    collect(doc.root.children);

    const pages: PdfPage[] = [];
    let cur: PdfPage["lines"] = [];
    let y = pageHeight - margin;
    for (const line of lines) {
      if (line.style === "break") {
        pages.push({ lines: [...cur] });
        cur = [];
        y = pageHeight - margin;
        continue;
      }
      cur.push({ ...line, y });
      y -= 18;
      if (y < margin) {
        pages.push({ lines: [...cur] });
        cur = [];
        y = pageHeight - margin;
      }
    }
    if (cur.length) pages.push({ lines: cur });
    if (pages.length === 0) pages.push({ lines: [] });
    return pages;
  }

  private assemblePdf(pages: PdfPage[], doc: PortableDocument): Uint8Array {
    const objects: string[] = [];

    function addObj(content: string): number {
      objects.push(content);
      return objects.length; // 1-indexed
    }

    addObj(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
    objects.push(null as unknown as string); // placeholder for 2 0 obj
    addObj(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

    const pageObjNums: number[] = [];

    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i]!;
      let stream = "BT\n/F1 12 Tf\n";
      let y = 750;
      const x = 50;
      for (const line of pg.lines) {
        const escaped = pdfEscape(line.text.slice(0, 500));
        stream += `1 0 0 1 ${x} ${y} Tm\n(${escaped}) Tj\n`;
        y -= line.style === "heading" ? 22 : 16;
      }
      stream += "ET";
      const streamBytesLen = new TextEncoder().encode(stream).length;
      const contentNum = objects.length + 1;
      const streamObj = `${contentNum} 0 obj\n<< /Length ${streamBytesLen} >>\nstream\n${stream}\nendstream\nendobj`;
      addObj(streamObj);
      const pageNum = objects.length + 1;
      const pageObj = `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentNum} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj`;
      addObj(pageObj);
      pageObjNums.push(pageNum);
    }

    const kids = pageObjNums.map((n) => `${n} 0 R`).join(" ");
    const pagesObj = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj`;
    objects[1] = pagesObj;

    const infoNum = objects.length + 1;
    const now: string = this.clock.nowIso();
    const title = (doc.metadata?.title as string | undefined) ?? "Portable Document";
    addObj(`${infoNum} 0 obj\n<< /Title (${pdfEscape(title)}) /Creator (portable-doc-editor) /CreationDate (D:${now.replace(/[-:T]/g, "").slice(0, 14)}) >>\nendobj`);

    let pdf = "%PDF-1.4\n%âãÏÓ\n";
    const objOffsets: number[] = [];
    for (const objStr of objects) {
      objOffsets.push(pdf.length);
      pdf += objStr + "\n";
    }
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += `0000000000 65535 f \n`;
    for (const off of objOffsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoNum} 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;
    return new TextEncoder().encode(pdf);
  }
}
