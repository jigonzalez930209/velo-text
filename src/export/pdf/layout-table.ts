import type { TableNode } from "../../core/model/types.js";
import type { TextMarks } from "../../core/model/primitives.js";
import { DENSITY_PT, TABLE_FILLS, cellFill, cellVAlign } from "../../core/model/table-look.js";
import { cssToHex6 } from "../../core/model/office-colors.js";
import { parseMath, helveticaWidthPt, mathVisualExtents } from "./equation.js";
import { pdfFaceForMarks } from "./fonts.js";
import { segmentWidthPt } from "./paint.js";
import { copyTextSeg, type PdfLine, type Segment, type TextSegment } from "./pdf-model.js";

type Inline = {
  type: string;
  text?: string;
  source?: string;
  latex?: string;
  marks?: TextMarks;
  children?: Array<{ text?: string; marks?: TextMarks }>;
};

function textStyle(marks: TextMarks | undefined, defaultSizePt: number, headingBold?: boolean): Omit<TextSegment, "kind" | "text"> {
  return {
    sizePt: marks?.fontSizePt && marks.fontSizePt > 0 ? marks.fontSizePt : defaultSizePt,
    face: pdfFaceForMarks(!!(marks?.bold || marks?.code || headingBold), !!marks?.italic, marks?.fontFamily),
    color: cssToHex6(marks?.color) ?? marks?.color,
    background: cssToHex6(marks?.background) ?? marks?.background,
    underline: !!marks?.underline,
    strike: !!marks?.strike,
  };
}

export function inlineToSegments(children: Inline[], sizePt: number, opts?: { headingBold?: boolean }): Segment[] {
  const segs: Segment[] = [];
  let buf = "";
  let style = textStyle(undefined, sizePt, opts?.headingBold);
  const flush = () => {
    if (buf) segs.push({ kind: "text", text: buf, ...style });
    buf = "";
  };
  const append = (text: string, marks?: TextMarks) => {
    const next = textStyle(marks, sizePt, opts?.headingBold);
    if (
      next.sizePt !== style.sizePt || next.face !== style.face || next.color !== style.color
      || next.background !== style.background || next.underline !== style.underline || next.strike !== style.strike
    ) {
      flush();
      style = next;
    }
    buf += text;
  };
  for (const c of children) {
    if (c.type === "text") append(c.text ?? "", c.marks);
    else if (c.type === "variable") append(c.source ?? "", c.marks);
    else if (c.type === "hard-break") { flush(); segs.push({ kind: "rule", widthPt: 0 }); }
    else if (c.type === "equation") {
      flush();
      segs.push({ kind: "math", math: parseMath(c.latex ?? "", sizePt), sizePt });
    } else if (c.type === "link") {
      for (const child of c.children ?? []) append(child.text ?? "", child.marks);
    } else if (c.type === "footnote-ref") {
      flush();
      const mark = (c as unknown as { customMark?: string }).customMark ?? "1";
      segs.push({
        kind: "text",
        text: mark,
        sizePt: Math.max(6, Math.round(sizePt * 0.7)),
        face: "F4",
      });
    }
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
    const w = s.kind === "text" ? segmentWidthPt(s.text, s.sizePt, s.face) : s.kind === "math" ? s.math.widthPt + 8 : 0;
    if (s.kind === "text") {
      for (const part of s.text.split(/(\s+)/)) {
        if (!part) continue;
        let rest = part;
        while (rest) {
          const pw = segmentWidthPt(rest, s.sizePt, s.face);
          if (curW + pw > maxWidth && cur.length) { flush(); continue; }
          if (pw > maxWidth && rest.length > 1) {
            let n = rest.length - 1;
            while (n > 1 && segmentWidthPt(rest.slice(0, n), s.sizePt, s.face) > maxWidth) n--;
            cur.push(copyTextSeg(s, rest.slice(0, n)));
            curW += segmentWidthPt(rest.slice(0, n), s.sizePt, s.face);
            rest = rest.slice(n);
            flush();
          } else {
            cur.push(copyTextSeg(s, rest));
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
      } else if (s.kind === "text") lh = Math.max(lh, s.sizePt + 3);
    }
    h += lh;
  }
  return h;
}

export function flattenWrapped(rows: Segment[][]): Segment[] {
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
        if (bl.type === "paragraph") segs.push(...inlineToSegments(bl.children as never, 11));
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
      const fill = cssToHex6(cellFill(cell, tbl, ri, ci) ?? "");
      const fillTok = fill ? `F${fill}` : "F-";
      const img = imgs[ci];
      const imgBits = img ? ` ${img.id} ${img.w} ${img.h}` : " - 0 0";
      const cellAlign = row.header ? "center" : ((cell.blocks[0] as { align?: string } | undefined)?.align ?? "left");
      const fgTok = fill === TABLE_FILLS.header ? " fgW" : " fgK";
      const va = cellVAlign(cell);
      lines.push({
        segments: packed[ci] ?? [],
        yPt: 0,
        sizePt: 9,
        align: cellAlign === "center" || cellAlign === "right" ? cellAlign : "left",
        style: `table-cell ${ci} ${row.id} ${ri} ${colW[ci]} ${h} ${cellAlign} ${fillTok}${imgBits}${fgTok} va-${va}`,
      });
    }
    lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: `table-row-end ${h}` });
  }
  lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: "table-bottom" });
}

export function lineVerticalExtent(line: PdfLine, fallback: number): { above: number; below: number } {
  const size = Math.max(
    line.sizePt || 11,
    ...line.segments.map((s) => s.kind === "text" ? s.sizePt : 0),
  );
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
