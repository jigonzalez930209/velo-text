import type { PortableDocument } from "../../core/model/types.js";
import { parseMath, helveticaWidthPt } from "./equation.js";
import type { PdfLine, PdfPage, Segment } from "./pdf-model.js";

export function buildPdfPages(doc: PortableDocument): PdfPage[] {
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
      const push = (seg: Segment, w: number): void => {
        if (curW + w > maxWidth && cur.length) flushLine();
        cur.push(seg);
        curW += w;
      };
      for (const s of segs) {
        if (s.kind === "text") {
          for (const part of s.text.split(/(\s+)/)) {
            if (!part) continue;
            push({ kind: "text", text: part, sizePt: s.sizePt }, helveticaWidthPt(part, s.sizePt));
          }
        } else if (s.kind === "math") push(s, s.math.widthPt + 8);
        else push(s, 0);
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
          const totalUm = tbl.columns.reduce((n, c) => n + c.widthUm, 0) || 1;
          const tableW = maxWidth;
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
            if (ri === 0) {
              lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: "table-top" });
            }
            x = 0;
            for (let ci = 0; ci < row.cells.length; ci++) {
              const cell = row.cells[ci]!;
              const cw = colW[ci]!;
              const segs2: Segment[] = [];
              for (const bl of cell.blocks) {
                if (bl.type === "paragraph") segs2.push(...inlineToSegments(bl.children as never, 9));
              }
              const cellAlign = row.header ? "center" : "left";
              lines.push({
                segments: segs2.map((s) => ({ ...s, sizePt: s.kind === "math" ? s.sizePt : 9 })),
                yPt: 0,
                sizePt: 9,
                align: cellAlign,
                style: `table-cell ${ci} ${row.id} ${ri} ${cw} ${h} ${cellAlign}`,
              });
              x++;
            }
            lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: `table-row-end ${h}` });
            void x;
          }
          lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: "table-bottom" });
        } else if (b.type === "columns") {
          const cols = (b as { columns: Array<{ id: string; blocks: PortableDocument["root"]["children"]; widthPct?: number }> }).columns;
          const n = Math.max(2, cols.length);
          const tableW = maxWidth;
          const colW = cols.map((c) => ((c.widthPct ?? 100 / n) / 100) * tableW);
          let h = 28;
          for (const col of cols) {
            let cellH = 28;
            for (const bl of col.blocks) {
              if (bl.type === "paragraph") cellH += 14;
              else cellH += 18;
            }
            h = Math.max(h, cellH);
          }
          for (let ci = 0; ci < cols.length; ci++) {
            const col = cols[ci]!;
            const segs2: Segment[] = [];
            for (const bl of col.blocks) {
              if (bl.type === "paragraph") segs2.push(...inlineToSegments(bl.children as never, 9));
              else if (bl.type === "heading") segs2.push(...inlineToSegments(bl.children as never, 11));
            }
            lines.push({
              segments: segs2,
              yPt: 0,
              sizePt: 9,
              align: "left",
              style: `table-cell ${ci} ${b.id} 0 ${colW[ci]} ${h}`,
            });
          }
          lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: `table-row-end ${h}` });
          lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: "table-bottom" });
        } else if (b.type === "equation-block") {
          const math = parseMath((b as { latex: string }).latex ?? "", 12);
          lines.push({ segments: [{ kind: "math", math, sizePt: 12 }], yPt: 0, sizePt: 12, align: "center", style: "equation-block" });
        } else if (b.type === "horizontal-rule") {
          lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 11, align: "left", style: "hr" });
        } else if (b.type === "page-break") {
          lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 11, align: "left", style: "page-break" });
        } else if (b.type === "image") {
          const img = b as { assetId: string; widthUm?: number; heightUm?: number; align?: "left" | "center" | "right" };
          const align = img.align === "center" || img.align === "right" ? img.align : "left";
          lines.push({
            segments: [{ kind: "text", text: "", sizePt: 0 }],
            yPt: 0, sizePt: 11, align, style: `image ${img.assetId} ${img.widthUm ?? 0} ${img.heightUm ?? 0}`,
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
      if (line.style === "table-top") {
        cur.push({ line, yPt: y });
        continue;
      }
      if (line.style === "table-bottom") {
        cur.push({ line, yPt: y });
        y -= 8;
        if (y < marginPt) {
          pages.push({ lines: cur });
          cur = [];
          y = pageHeightPt - marginPt;
        }
        continue;
      }
      if (line.style.startsWith("table-cell")) {
        cur.push({ line, yPt: y });
        continue;
      }
      if (line.style.startsWith("table-row-end")) {
        const rowH = Number(line.style.split(" ")[1]) || 30;
        cur.push({ line, yPt: y });
        y -= rowH;
        if (y < marginPt) {
          pages.push({ lines: cur });
          cur = [];
          y = pageHeightPt - marginPt;
        }
        continue;
      }
      if (line.style.startsWith("image ")) {
        const parts = line.style.split(" ");
        const hUm = Number(parts[3]) || 90000;
        const hPt = Math.min(360, Math.max(24, (hUm / 25400) * 72));
        cur.push({ line, yPt: y });
        y -= hPt + 10;
        if (y < marginPt) {
          pages.push({ lines: cur });
          cur = [];
          y = pageHeightPt - marginPt;
        }
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
