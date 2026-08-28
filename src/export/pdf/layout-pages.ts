import type { PortableDocument } from "../../core/model/types.js";
import { parseMath, helveticaWidthPt } from "./equation.js";
import type { PdfLine, PdfPage, Segment } from "./pdf-model.js";
import { pdfPageMetrics } from "./page-metrics.js";
import { emitColumns, emitTable, inlineToSegments, lineVerticalExtent } from "./layout-table.js";

export function buildPdfPages(doc: PortableDocument): PdfPage[] {
  const m = pdfPageMetrics(doc);
  const pageHeightPt = m.heightPt;
  const pageWidthPt = m.widthPt;
  const marginPt = m.marginLeftPt;
  const bottomPt = m.marginBottomPt;
  const maxWidth = pageWidthPt - m.marginLeftPt - m.marginRightPt;
  const lines: PdfLine[] = [];
  const pageOf = (rows: PdfPage["lines"]): PdfPage => ({
    lines: rows, widthPt: pageWidthPt, heightPt: pageHeightPt, marginPt,
  });

  const wrap = (segs: Segment[], align: string, style: string, baseSize: number): void => {
    const from = lines.length;
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
    if (lines.length > from) lines[lines.length - 1]!.style = `${style} last`;
  };

  for (const b of doc.root.children) {
    if (b.type === "paragraph") wrap(inlineToSegments(b.children as never, 11), (b as { align?: string }).align ?? "left", "paragraph", 11);
    else if (b.type === "heading") wrap(inlineToSegments(b.children as never, 20 - b.level * 2), "left", "heading", 20 - b.level * 2);
    else if (b.type === "quote") wrap(inlineToSegments(b.children as never, 11), "left", "quote", 11);
    else if (b.type === "list") {
      for (const it of b.items) {
        const prefix = b.kind === "ordered" ? "1. " : "•  ";
        wrap([{ kind: "text", text: prefix, sizePt: 11 }, ...inlineToSegments(it.content as never, 11)], "left", "list", 11);
      }
    } else if (b.type === "table") emitTable(lines, b, maxWidth);
    else if (b.type === "columns") emitColumns(lines, b, maxWidth);
    else if (b.type === "equation-block") {
      const math = parseMath(b.latex ?? "", 12);
      lines.push({ segments: [{ kind: "math", math, sizePt: 12 }], yPt: 0, sizePt: 12, align: "center", style: "equation-block" });
    } else if (b.type === "horizontal-rule") {
      lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 11, align: "left", style: "hr" });
    } else if (b.type === "page-break") {
      lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 11, align: "left", style: "page-break" });
    } else if (b.type === "image") {
      const align = b.align === "center" || b.align === "right" ? b.align : "left";
      lines.push({
        segments: [{ kind: "text", text: "", sizePt: 0 }],
        yPt: 0, sizePt: 11, align, style: `image ${b.assetId} ${b.widthUm ?? 0} ${b.heightUm ?? 0}`,
      });
    }
  }

  const pages: PdfPage[] = [];
  let cur: Array<{ line: PdfLine; yPt: number }> = [];
  let y = pageHeightPt - m.marginTopPt;
  const overflow = (): boolean => y < bottomPt;
  for (const line of lines) {
    if (line.style === "page-break") {
      if (cur.length) pages.push(pageOf(cur));
      cur = [];
      y = pageHeightPt - m.marginTopPt;
      continue;
    }
    if (line.style === "table-top" || line.style.startsWith("table-cell") || line.style.startsWith("flow-cell")) {
      cur.push({ line, yPt: y });
      continue;
    }
    if (line.style === "table-bottom") {
      cur.push({ line, yPt: y });
      y -= 24;
    } else if (line.style.startsWith("table-row-end")) {
      const rowH = Number(line.style.split(" ")[1]) || 30;
      cur.push({ line, yPt: y });
      y -= rowH;
    } else if (line.style.startsWith("image ")) {
      const hUm = Number(line.style.split(" ")[3]) || 90000;
      const hPt = Math.min(360, Math.max(24, (hUm / 25400) * 72));
      cur.push({ line, yPt: y });
      y -= hPt + 13;
    } else {
      const ext = lineVerticalExtent(line, 16);
      const paraGap = line.style.endsWith(" last") ? 4 : 2;
      y -= ext.above;
      cur.push({ line, yPt: y });
      y -= ext.below + paraGap;
    }
    if (overflow()) {
      pages.push(pageOf(cur));
      cur = [];
      y = pageHeightPt - m.marginTopPt;
    }
  }
  if (cur.length) pages.push(pageOf(cur));
  if (pages.length === 0) pages.push(pageOf([]));
  return pages;
}
