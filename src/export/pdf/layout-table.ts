import type { PortableDocument, TableNode } from "../../core/model/types.js";
import { DENSITY_PT, cellFill } from "../../core/model/table-look.js";
import { parseMath, helveticaWidthPt, mathVisualExtents } from "./equation.js";
import type { PdfLine, Segment } from "./pdf-model.js";

type Inline = { type: string; text?: string; source?: string; latex?: string; children?: Array<{ text?: string }> };

export function inlineToSegments(children: Inline[], sizePt: number): Segment[] {
  const segs: Segment[] = [];
  let buf = "";
  const flush = () => { if (buf) { segs.push({ kind: "text", text: buf, sizePt }); buf = ""; } };
  for (const c of children) {
    if (c.type === "text") buf += c.text ?? "";
    else if (c.type === "variable") buf += c.source ?? "";
    else if (c.type === "hard-break") { flush(); segs.push({ kind: "rule", widthPt: 0 }); }
    else if (c.type === "equation") { flush(); segs.push({ kind: "math", math: parseMath(c.latex ?? "", sizePt), sizePt }); }
    else if (c.type === "link") buf += c.children?.map((x) => x.text ?? "").join("") ?? "";
  }
  flush();
  return segs;
}

export function wrapSegs(segs: Segment[], maxWidth: number): Segment[][] {
  const lines: Segment[][] = [];
  let cur: Segment[] = [];
  let curW = 0;
  const flush = () => { if (cur.length) lines.push(cur); cur = []; curW = 0; };
  for (const s of segs) {
    if (s.kind === "rule") { flush(); continue; }
    const w = s.kind === "text" ? helveticaWidthPt(s.text, s.sizePt) : s.kind === "math" ? s.math.widthPt + 8 : 0;
    if (s.kind === "text") {
      for (const part of s.text.split(/(\s+)/)) {
        if (!part) continue;
        let rest = part;
        while (rest) {
          const pw = helveticaWidthPt(rest, s.sizePt);
          if (curW + pw > maxWidth && cur.length) { flush(); continue; }
          if (pw > maxWidth && rest.length > 1) {
            let n = rest.length - 1;
            while (n > 1 && helveticaWidthPt(rest.slice(0, n), s.sizePt) > maxWidth) n--;
            cur.push({ kind: "text", text: rest.slice(0, n), sizePt: s.sizePt });
            curW += helveticaWidthPt(rest.slice(0, n), s.sizePt);
            rest = rest.slice(n);
            flush();
          } else {
            cur.push({ kind: "text", text: rest, sizePt: s.sizePt });
            curW += pw;
            rest = "";
          }
        }
      }
    } else {
      if (curW + w > maxWidth && cur.length) flush();
      cur.push(s);
      curW += w;
    }
  }
  flush();
  return lines.length ? lines : [[]];
}

export function wrappedBlockHeight(rows: Segment[][], minLine = 14): number {
  let h = 8;
  for (const row of rows) {
    let lh = minLine;
    for (const s of row) {
      if (s.kind === "math") {
        const e = mathVisualExtents(s.math);
        lh = Math.max(lh, e.abovePt + e.belowPt);
      }
    }
    h += lh;
  }
  return h;
}

function flattenWrapped(rows: Segment[][]): Segment[] {
  const out: Segment[] = [];
  rows.forEach((row, i) => {
    if (i) out.push({ kind: "rule", widthPt: 0 });
    out.push(...row);
  });
  return out;
}

export function emitTable(lines: PdfLine[], tbl: TableNode, maxWidth: number): void {
  const totalUm = tbl.columns.reduce((n, c) => n + c.widthUm, 0) || 1;
  const colW = tbl.columns.map((c) => (c.widthUm / totalUm) * maxWidth);
  const baseH = DENSITY_PT[tbl.style?.density ?? "normal"] ?? 28;
  lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: "table-top" });
  for (let ri = 0; ri < tbl.rows.length; ri++) {
    const row = tbl.rows[ri]!;
    let h = row.heightUm ? Math.max(baseH, (row.heightUm / 25400) * 72) : baseH;
    const packed: Segment[][] = [];
    const imgs: Array<{ id: string; w: number; h: number } | null> = [];
    for (let ci = 0; ci < row.cells.length; ci++) {
      const cell = row.cells[ci]!;
      const segs: Segment[] = [];
      let img: { id: string; w: number; h: number } | null = null;
      for (const bl of cell.blocks) {
        if (bl.type === "paragraph") segs.push(...inlineToSegments(bl.children as never, 9));
        else if (bl.type === "image") {
          img = { id: bl.assetId, w: bl.widthUm ?? 40000, h: bl.heightUm ?? 20000 };
          h = Math.max(h, Math.min(80, (img.h / 25400) * 72 + 8));
        }
      }
      const wrapped = wrapSegs(segs, Math.max(20, colW[ci]! - 8));
      h = Math.max(h, wrappedBlockHeight(wrapped, 14));
      packed.push(flattenWrapped(wrapped));
      imgs.push(img);
    }
    for (let ci = 0; ci < row.cells.length; ci++) {
      const cell = row.cells[ci]!;
      const fill = cellFill(cell, tbl, ri, ci)?.replace("#", "") ?? "-";
      const img = imgs[ci];
      const imgBits = img ? ` ${img.id} ${img.w} ${img.h}` : " - 0 0";
      const cellAlign = row.header ? "center" : ((cell.blocks[0] as { align?: string } | undefined)?.align ?? "left");
      const headerFg = tbl.style?.look?.headerRow && ri === 0 ? " white" : "";
      lines.push({
        segments: packed[ci] ?? [],
        yPt: 0,
        sizePt: 9,
        align: cellAlign === "center" || cellAlign === "right" ? cellAlign : "left",
        style: `table-cell ${ci} ${row.id} ${ri} ${colW[ci]} ${h} ${cellAlign} ${fill}${imgBits}${headerFg}`,
      });
    }
    lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: `table-row-end ${h}` });
  }
  lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: "table-bottom" });
}

export function emitColumns(
  lines: PdfLine[],
  block: { id: string; columns: Array<{ blocks: PortableDocument["root"]["children"]; widthPct?: number }> },
  maxWidth: number,
): void {
  const n = Math.max(2, block.columns.length);
  const gap = 8;
  const inner = Math.max(40, maxWidth - gap * (n - 1));
  const colW = block.columns.map((c) => ((c.widthPct ?? 100 / n) / 100) * inner);
  let h = 28;
  const packed: Segment[][] = [];
  const imgs: Array<{ id: string; w: number; h: number } | null> = [];
  for (let ci = 0; ci < block.columns.length; ci++) {
    const col = block.columns[ci]!;
    const segs: Segment[] = [];
    let img: { id: string; w: number; h: number } | null = null;
    for (const bl of col.blocks) {
      if (bl.type === "paragraph") {
        if (segs.length) segs.push({ kind: "rule", widthPt: 0 });
        segs.push(...inlineToSegments(bl.children as never, 11));
      } else if (bl.type === "heading") {
        if (segs.length) segs.push({ kind: "rule", widthPt: 0 });
        segs.push(...inlineToSegments(bl.children as never, 12));
      } else if (bl.type === "image") {
        img = { id: bl.assetId, w: bl.widthUm ?? 0, h: bl.heightUm ?? 0 };
      }
    }
    const wrapped = wrapSegs(segs, Math.max(24, colW[ci]! - 10));
    h = Math.max(h, wrappedBlockHeight(wrapped, 16));
    if (img) h = Math.max(h, Math.min(120, (img.h / 25400) * 72) + 16);
    packed.push(flattenWrapped(wrapped));
    imgs.push(img);
  }
  for (let ci = 0; ci < block.columns.length; ci++) {
    const img = imgs[ci];
    const imgBits = img ? ` ${img.id} ${img.w} ${img.h}` : "";
    lines.push({
      segments: packed[ci] ?? [],
      yPt: 0,
      sizePt: 9,
      align: "left",
      style: `flow-cell ${ci} ${block.id} 0 ${colW[ci]} ${h} ${gap}${imgBits}`,
    });
  }
  lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: `table-row-end ${h}` });
  lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: "table-bottom" });
}

export function lineVerticalExtent(line: PdfLine, fallback: number): { above: number; below: number } {
  const size = line.sizePt || 11;
  let above = size * 0.8;
  let below = size * 0.28 + 2;
  const minTotal = fallback;
  for (const seg of line.segments) {
    if (seg.kind !== "math") continue;
    const e = mathVisualExtents(seg.math);
    above = Math.max(above, e.abovePt);
    below = Math.max(below, e.belowPt);
  }
  if (above + below < minTotal) below += minTotal - (above + below);
  return { above, below };
}

export function mathLineAdvance(line: PdfLine, fallback: number): number {
  const e = lineVerticalExtent(line, fallback);
  return e.above + e.below;
}
