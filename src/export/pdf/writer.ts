/**
 * PdfWriter — Phase 7 (hardened)
 * Deterministic PDF with real text positioning, LaTeX equations (Helvetica + Symbol),
 * tables (grid + cell text) and PNG/JPEG images as XObjects.
 * No external dependencies: Type1 base fonts, uncompressed image data.
 */
import type { PortableDocument, BinarySink, Clock, IdGenerator } from "../../core/model/types.js";
import { parseMath, helveticaWidthPt, pdfLiteralString, type MathBox } from "./equation.js";
import { decodeImageForPdf, type DecodedImage } from "./image.js";

function pdfEscape(str: string): string {
  return String(str).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

type Segment =
  | { kind: "text"; text: string; sizePt: number }
  | { kind: "math"; math: MathBox; sizePt: number }
  | { kind: "rule"; widthPt: number };

interface PdfLine {
  segments: Segment[];
  yPt: number;
  sizePt: number;
  align: "left" | "center" | "right" | "justify";
  style: string;
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

  async write(
    layoutOrDoc: PortableDocument | { document: PortableDocument },
    sink: BinarySink,
    assets?: Record<string, { id: string; mediaType: string; data: Uint8Array; widthPx?: number; heightPx?: number }>,
  ): Promise<PdfWriteResult> {
    const doc: PortableDocument = (layoutOrDoc as { document: PortableDocument }).document ?? (layoutOrDoc as PortableDocument);
    const pages = this.buildPages(doc);
    // Decode images (PNG -> RGB via inflate; JPEG pass-through)
    const decoded = new Map<string, DecodedImage | null>();
    for (const [id, ref] of Object.entries(assets ?? {})) {
      decoded.set(id, await decodeImageForPdf(ref.data, ref.mediaType));
    }
    const pdfBytes = this.assemblePdf(pages, doc, assets ?? {}, decoded);
    await sink.write(pdfBytes);
    await sink.close?.();
    return { byteLength: pdfBytes.length, pages: pages.length };
  }

  // ── Layout: greedy wrap over mixed text/math segments ──
  private buildPages(doc: PortableDocument): PdfPage[] {
    const pageHeightPt = 842; // A4
    const pageWidthPt = 595;
    const marginPt = 57;
    const maxWidth = pageWidthPt - marginPt * 2;
    const lines: PdfLine[] = [];

    const inlineToSegments = (children: Array<{ type: string; text?: string; source?: string; latex?: string }>, sizePt: number): Segment[] => {
      const segs: Segment[] = [];
      let buf = "";
      const flush = () => {
        if (buf) { segs.push({ kind: "text", text: buf, sizePt }); buf = ""; }
      };
      for (const c of children) {
        if (c.type === "text") { buf += c.text ?? ""; }
        else if (c.type === "variable") { buf += c.source ?? ""; }
        else if (c.type === "hard-break") { flush(); segs.push({ kind: "rule", widthPt: 0 }); }
        else if (c.type === "equation") { flush(); segs.push({ kind: "math", math: parseMath(c.latex ?? "", sizePt), sizePt }); }
        else if (c.type === "link") { buf += (c as { children?: Array<{ text?: string }> }).children?.map((x) => x.text ?? "").join("") ?? ""; }
      }
      flush();
      return segs;
    };

    const wrap = (segs: Segment[], align: string, style: string, baseSize: number): void => {
      let cur: Segment[] = [];
      let curW = 0;
      const flushLine = () => {
        if (cur.length) lines.push({ segments: cur, yPt: 0, sizePt: baseSize, align: align as never, style });
        cur = [];
        curW = 0;
      };
      for (const s of segs) {
        const w = s.kind === "text" ? helveticaWidthPt(s.text, s.sizePt) : s.kind === "math" ? s.math.widthPt : 0;
        if (curW + w > maxWidth && cur.length) {
          flushLine();
          // Leading space dropped
          if (s.kind === "text" && s.text.startsWith(" ")) { cur.push({ ...s, text: s.text.slice(1) }); curW = Math.max(0, w - helveticaWidthPt(" ", s.sizePt)); }
          else { cur.push(s); curW = w; }
          continue;
        }
        cur.push(s);
        curW += w;
      }
      flushLine();
    };

    const collect = (blocks: PortableDocument["root"]["children"]): void => {
      for (const b of blocks) {
        if (b.type === "paragraph") wrap(inlineToSegments(b.children as never, 11), (b as { align?: string }).align ?? "left", "paragraph", 11);
        else if (b.type === "heading") {
          const lvl = (b as { level: number }).level;
          const size = 20 - lvl * 2;
          wrap(inlineToSegments(b.children as never, size), "left", "heading", size);
        } else if (b.type === "quote") wrap(inlineToSegments(b.children as never, 11), "left", "quote", 11);
        else if (b.type === "list") {
          for (const it of (b as { items: Array<{ content: Array<{ type: string; text?: string; source?: string; latex?: string }> }> }).items) {
            const prefix = (b as { kind: string }).kind === "ordered" ? "1. " : "•  ";
            const segs: Segment[] = [{ kind: "text", text: prefix, sizePt: 11 }, ...inlineToSegments(it.content, 11)];
            wrap(segs, "left", "list", 11);
          }
        } else if (b.type === "table") {
          const tbl = b as { id: string; columns: Array<{ widthUm: number }>; rows: Array<{ id: string; header?: boolean; cells: Array<{ blocks: PortableDocument["root"]["children"] }> }> };
          const totalUm = tbl.columns.reduce((n, c) => n + c.widthUm, 0);
          const tableW = Math.min(maxWidth, 500);
          const colW = tbl.columns.map((c) => (c.widthUm / totalUm) * tableW);
          const rowH = 30;
          const yStart = 0;
          void yStart;
          let y = 0;
          for (let ri = 0; ri < tbl.rows.length; ri++) {
            const row = tbl.rows[ri]!;
            let x = 0;
            let h = rowH;
            // estimate row height from cell content lines
            for (const cell of row.cells) {
              const segs: Segment[] = [];
              for (const bl of cell.blocks) {
                if (bl.type === "paragraph") segs.push(...inlineToSegments(bl.children as never, 9));
              }
              const cellW = colW[Math.min(x, colW.length - 1)]!;
              let w = 0;
              let cellH = rowH;
              for (const s of segs) {
                const sw = s.kind === "text" ? helveticaWidthPt(s.text, s.sizePt) : s.kind === "math" ? s.math.widthPt : 0;
                w += sw;
                if (w > cellW && s.kind === "text") { cellH += 14; w = sw; }
              }
              h = Math.max(h, cellH);
              x++;
            }
            // grid
            lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: "table-top" });
            x = 0;
            for (let ci = 0; ci < row.cells.length; ci++) {
              const cell = row.cells[ci]!;
              const cw = colW[ci]!;
              const segs2: Segment[] = [];
              for (const bl of cell.blocks) {
                if (bl.type === "paragraph") segs2.push(...inlineToSegments(bl.children as never, 9));
              }
              lines.push({
                segments: segs2.map((s) => ({ ...s, sizePt: s.kind === "math" ? s.sizePt : 9 })),
                yPt: 0,
                sizePt: 9,
                align: "left",
                style: `table-cell ${ci} ${row.id} ${ri} ${cw}`,
              });
              x++;
            }
            lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: "table-bottom" });
            void h;
          }
        } else if (b.type === "equation-block") {
          const math = parseMath((b as { latex: string }).latex ?? "", 12);
          lines.push({ segments: [{ kind: "math", math, sizePt: 12 }], yPt: 0, sizePt: 12, align: "center", style: "equation-block" });
        } else if (b.type === "horizontal-rule") {
          lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 11, align: "left", style: "hr" });
        } else if (b.type === "page-break") {
          lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 11, align: "left", style: "page-break" });
        } else if (b.type === "image") {
          const img = b as { assetId: string; widthUm?: number; heightUm?: number };
          lines.push({
            segments: [{ kind: "text", text: "", sizePt: 0 }],
            yPt: 0, sizePt: 11, align: "left", style: `image ${img.assetId} ${img.widthUm ?? 0} ${img.heightUm ?? 0}`,
          });
        }
      }
    };
    collect(doc.root.children);

    // Paginate lines: assign y positions, splitting at page-break lines
    const pages: PdfPage[] = [];
    let cur: Array<{ line: PdfLine; yPt: number }> = [];
    let y = pageHeightPt - marginPt;
    const lineH = 16;
    for (const line of lines) {
      if (line.style === "page-break") {
        if (cur.length) pages.push({ lines: cur });
        cur = [];
        y = pageHeightPt - marginPt;
        continue;
      }
      if (line.style === "table-top" || line.style === "table-bottom") {
        cur.push({ line, yPt: y });
        continue;
      }
      if (line.style.startsWith("table-cell")) {
        cur.push({ line, yPt: y });
        continue;
      }
      cur.push({ line, yPt: y });
      y -= lineH;
      if (y < marginPt) {
        pages.push({ lines: cur });
        cur = [];
        y = pageHeightPt - marginPt;
      }
    }
    if (cur.length) pages.push({ lines: cur });
    if (pages.length === 0) pages.push({ lines: [] });
    return pages;
  }

  private assemblePdf(
    pages: PdfPage[],
    doc: PortableDocument,
    assets: Record<string, { id: string; mediaType: string; data: Uint8Array }>,
    decoded: Map<string, DecodedImage | null>,
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

    // Content streams per page
    for (const page of pages) {
      const { stream } = this.pageContentStream(page, doc, imageObjects);
      const contentNum = objects.length + 1;
      const bytesLen = new TextEncoder().encode(stream).length;
      addObj(`${contentNum} 0 obj\n<< /Length ${bytesLen} >>\nstream\n${stream}\nendstream\nendobj`);
      const pageNum = objects.length + 1;
      addObj(`${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentNum} 0 R /Resources << /Font << /F1 3 0 R /F2 ${symbolNum} 0 R >> ${imageObjects.size ? `/XObject << ${[...imageObjects.entries()].map(([k, n]) => `/Im${k} ${n} 0 R`).join(" ")} >> ` : ""}>> >>\nendobj`);
      (page as { objNum?: number }).objNum = pageNum;
    }

    const kids = pages.map((p) => `${p.objNum} 0 R`).join(" ");
    objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj`;

    const infoNum = objects.length + 1;
    const now = this.clock.nowIso();
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

  private pageContentStream(page: PdfPage, doc: PortableDocument, imageObjects: Map<string, number>): { stream: string } {
    void doc;
    let s = "";
    const marginPt = 57;
    let cursorX = marginPt;
    let tableState: { colW: number[]; row: number; x: number; y: number } | null = null;
    const pageWidthPt = 595;

    for (const { line, yPt } of page.lines) {
      const y = yPt;
      if (line.style === "page-break") continue;
      if (line.style === "hr") {
        s += `0.4 w 0.6 0.6 0.6 RG ${marginPt} ${y} m ${pageWidthPt - marginPt} ${y} l S\n`;
        continue;
      }
      if (line.style === "table-top" || line.style === "table-bottom") {
        // handled by cell lines below
        continue;
      }
      if (line.style.startsWith("table-cell")) {
        const parts = line.style.split(" ");
        const ci = Number(parts[1]);
        const rowId = parts[2];
        const ri = Number(parts[3]);
        const cw = Number(parts[4]);
        void rowId;
        if (tableState === null || tableState.row !== ri) {
          tableState = { colW: [], row: ri, x: marginPt, y };
        }
        // draw cell borders
        s += `0.3 w 0.4 0.4 0.4 RG\n`;
        s += `${tableState.x} ${y} m ${tableState.x + cw} ${y} l S\n`;
        s += `${tableState.x + cw} ${y} m ${tableState.x + cw} ${y - 28} l S\n`;
        // cell text
        const cellX = tableState.x + 4;
        const segs = line.segments;
        let sx = cellX;
        s += `BT /F1 9 Tf\n`;
        for (const seg of segs) {
          if (seg.kind === "text") {
            s += `1 0 0 1 ${sx} ${y - 10} Tm (${pdfEscape(seg.text)}) Tj\n`;
            sx += helveticaWidthPt(seg.text, 9);
          } else if (seg.kind === "math") {
            for (const r of seg.math.runs) {
              const fn = r.font === "Symbol" ? "F2" : "F1";
              s += `1 0 0 1 ${(sx + r.xPt).toFixed(2)} ${(y - 10 + r.yPt).toFixed(2)} Tm /${fn} ${r.sizePt} Tf (${pdfLiteralString(r.text)}) Tj\n`;
            }
            sx += seg.math.widthPt;
          }
        }
        s += `ET\n`;
        tableState.x += cw;
        cursorX = tableState.x;
        continue;
      }
      if (line.style.startsWith("image ")) {
        const parts = line.style.split(" ");
        const assetId = parts[1];
        const wUm = Number(parts[2]) || 150000;
        const hUm = Number(parts[3]) || 90000;
        const objNum = imageObjects.get(assetId);
        if (!objNum) {
          s += `BT /F1 9 Tf 1 0 0 1 ${marginPt} ${y} Tm (${pdfEscape(`[missing image ${assetId}]`)}) Tj ET\n`;
          continue;
        }
        const wPt = (wUm / 25400) * 72;
        const hPt = (hUm / 25400) * 72;
        const x = marginPt;
        const yy = y - hPt;
        s += `q ${wPt.toFixed(2)} 0 0 ${hPt.toFixed(2)} ${x.toFixed(2)} ${yy.toFixed(2)} cm /Im${assetId} Do Q\n`;
        cursorX = marginPt;
        continue;
      }
      if (line.style === "equation-block") {
        const mathSeg = line.segments.find((x): x is { kind: "math"; math: MathBox; sizePt: number } => x.kind === "math");
        if (mathSeg) {
          const x = (pageWidthPt - mathSeg.math.widthPt) / 2;
          s += this.mathOps(mathSeg.math, x, y, "F1", "F2");
        }
        cursorX = marginPt;
        continue;
      }

      // Normal line: text + math segments
      const segs = line.segments;
      let x = marginPt;
      // alignment
      if (line.align === "center" || line.align === "right") {
        let w = 0;
        for (const seg of segs) w += seg.kind === "text" ? helveticaWidthPt(seg.text, seg.sizePt) : seg.kind === "math" ? seg.math.widthPt : 0;
        x = line.align === "center" ? (pageWidthPt - w) / 2 : pageWidthPt - marginPt - w;
      }
      cursorX = x;
      const firstText = segs.find((s) => s.kind === "text" && s.text.length > 0);
      const sizePt = line.sizePt || (firstText ? 11 : 11);
      let inText = false;
      for (const seg of segs) {
        if (seg.kind === "text" && seg.text.length === 0) continue;
        if (seg.kind === "text") {
          s += `BT /F1 ${sizePt} Tf 1 0 0 1 ${cursorX.toFixed(2)} ${y} Tm (${pdfEscape(seg.text)}) Tj ET\n`;
          cursorX += helveticaWidthPt(seg.text, seg.sizePt || sizePt);
          inText = true;
        } else if (seg.kind === "math") {
          s += this.mathOps(seg.math, cursorX, y, "F1", "F2");
          cursorX += seg.math.widthPt;
          inText = true;
        } else if (seg.kind === "rule") {
          // hard break within line: skip (line already split)
        }
      }
      void inText;
    }
    return { stream: s };
  }

  private mathOps(math: MathBox, x: number, y: number, f1: string, f2: string): string {
    let s = "";
    for (const r of math.runs) {
      const fn = r.font === "Symbol" ? f2 : f1;
      s += `BT /${fn} ${r.sizePt.toFixed(2)} Tf 1 0 0 1 ${(x + r.xPt).toFixed(2)} ${(y + r.yPt).toFixed(2)} Tm ${pdfLiteralString(r.text)} Tj ET\n`;
    }
    for (const rl of math.rules) {
      s += `0.6 w 0 0 0 RG 0 0 0 rg ${(x + rl.xPt).toFixed(2)} ${(y + rl.yPt - rl.heightPt / 2).toFixed(2)} ${rl.widthPt.toFixed(2)} ${rl.heightPt.toFixed(2)} re f S\n`;
    }
    return s;
  }
}

interface PdfPage {
  lines: Array<{ line: PdfLine; yPt: number }>;
  objNum?: number;
}