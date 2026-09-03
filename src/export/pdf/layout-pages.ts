import type { HeaderFooterZone, HeadingNode, InlineNode, PortableDocument, SectionSettings } from "../../core/model/types.js";
import { parseMath } from "./equation.js";
import type { PdfHeadingAnchor, PdfLine, PdfPage, PdfTocLink, Segment } from "./pdf-model.js";
import { pdfPageMetrics } from "./page-metrics.js";
import { emitTable, inlineToSegments, lineVerticalExtent } from "./layout-table.js";
import { emitColumns } from "./layout-columns.js";
import { segmentWidthPt } from "./paint.js";
import { resolveDynamicVariables } from "../layout/dynamic-vars.js";
import { tokenizeLine } from "../../core/code-highlight/index.js";

/** Fit an image into the page content box without overflowing. */
export function pdfImageDisplayPt(
  widthUm: number,
  heightUm: number,
  maxWidthPt: number,
  maxHeightPt: number,
): { wPt: number; hPt: number } {
  const wUm = widthUm > 0 ? widthUm : 150000;
  const hUm = heightUm > 0 ? heightUm : 90000;
  let wPt = Math.max(8, (wUm / 25400) * 72);
  let hPt = Math.max(8, (hUm / 25400) * 72);
  if (wPt > maxWidthPt && wPt > 0) {
    hPt *= maxWidthPt / wPt;
    wPt = maxWidthPt;
  }
  if (hPt > maxHeightPt && hPt > 0) {
    wPt *= maxHeightPt / hPt;
    hPt = maxHeightPt;
  }
  return { wPt, hPt };
}

export function buildPdfPages(doc: PortableDocument): PdfPage[] {
  const m = pdfPageMetrics(doc);
  const pageHeightPt = m.heightPt;
  const pageWidthPt = m.widthPt;
  const marginPt = m.marginLeftPt;
  const bottomPt = m.marginBottomPt;
  const maxWidth = pageWidthPt - m.marginLeftPt - m.marginRightPt;
  const lines: PdfLine[] = [];

  const pt = (um: number): number => Math.round((um / 25400) * 72);
  const hf = doc.page.headerFooter;
  const headerDistPt = hf ? pt(hf.headerDistanceUm ?? 12700) : 0;
  const footerDistPt = hf ? pt(hf.footerDistanceUm ?? 12700) : 0;
  const effectiveTopPt = (hf?.header || hf?.firstPageHeader || hf?.evenPageHeader)
    ? Math.max(m.marginTopPt, headerDistPt + 16)
    : m.marginTopPt;
  const effectiveBottomPt = (hf?.footer || hf?.firstPageFooter || hf?.evenPageFooter)
    ? Math.max(bottomPt, footerDistPt + 16)
    : bottomPt;

  let activeWidthPt = pageWidthPt;
  let activeHeightPt = pageHeightPt;
  let activeMarginLeftPt = marginPt;
  let activeMarginRightPt = m.marginRightPt;
  let activeMaxWidth = maxWidth;

  const wrap = (segs: Segment[], align: string, style: string, baseSize: number, maxW = activeMaxWidth): void => {
    const from = lines.length;
    let cur: Segment[] = [];
    let curW = 0;
    const flushLine = () => {
      if (cur.length) {
        const sizePt = Math.max(baseSize, ...cur.map((s) => s.kind === "text" ? s.sizePt : 0));
        lines.push({ segments: cur, yPt: 0, sizePt, align: align as never, style });
      }
      cur = [];
      curW = 0;
    };
    const push = (seg: Segment, w: number): void => {
      if (curW + w > maxW && cur.length) flushLine();
      cur.push(seg);
      curW += w;
    };
    for (const s of segs) {
      if (s.kind === "text") {
        for (const part of s.text.split(/(\s+)/)) {
          if (!part) continue;
          push({ ...s, text: part }, segmentWidthPt(part, s.sizePt, s.face));
        }
      } else if (s.kind === "math") push(s, s.math.widthPt + 8);
      else push(s, 0);
    }
    flushLine();
    if (lines.length > from) lines[lines.length - 1]!.style = `${style} last`;
  };

  for (const b of doc.root.children) {
    if (b.type === "paragraph" || b.type === "quote") {
      const from = lines.length;
      wrap(inlineToSegments(b.children as never, 11), (b as { align?: string }).align ?? "left", b.type, 11);
      const fnRefs = (b.children ?? []).filter((c) => (c as { type: string }).type === "footnote-ref");
      for (const fnRef of fnRefs) {
        const fnId = (fnRef as unknown as { footnoteId: string }).footnoteId;
        const mark = (fnRef as unknown as { customMark?: string }).customMark ?? "1";
        const fnDef = doc.footnotes?.[fnId];
        const text = fnDef ? fnDef.blocks.map((fb) => (fb.type === "paragraph" ? (fb.children ?? []).map((x) => (x as { text?: string }).text ?? "").join("") : "")).join(" ") : "";
        if (lines.length > from) {
          lines[lines.length - 1]!.style += ` fn:${fnId}:${encodeURIComponent(mark)}:${encodeURIComponent(text)}`;
        }
      }
    } else if (b.type === "heading") wrap(inlineToSegments(b.children as never, 20 - b.level * 2, { headingBold: true }), "left", `heading ${b.id} ${b.level}`, 20 - b.level * 2);
    else if (b.type === "list") {
      for (const it of b.items) {
        const prefix = b.kind === "ordered" ? "1. " : "•  ";
        wrap([{ kind: "text", text: prefix, sizePt: 11, face: "Fa" }, ...inlineToSegments(it.content as never, 11)], "left", "list", 11);
      }
    } else if (b.type === "table") emitTable(lines, b, activeMaxWidth);
    else if (b.type === "columns") emitColumns(lines, b, activeMaxWidth);
    else if (b.type === "equation-block") {
      const math = parseMath(b.latex ?? "", 12);
      lines.push({ segments: [{ kind: "math", math, sizePt: 12 }], yPt: 0, sizePt: 12, align: "center", style: "equation-block" });
    } else if (b.type === "horizontal-rule") {
      lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 11, align: "left", style: "hr" });
    } else if (b.type === "page-break") {
      lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 11, align: "left", style: "page-break" });
    } else if (b.type === "section-break") {
      const s = b.settings ?? {};
      let wPt = s.widthUm ? pt(s.widthUm) : pageWidthPt;
      let hPt = s.heightUm ? pt(s.heightUm) : pageHeightPt;
      if (s.orientation === "landscape" && wPt < hPt) {
        const tmp = wPt; wPt = hPt; hPt = tmp;
      } else if (s.orientation === "portrait" && wPt > hPt) {
        const tmp = wPt; wPt = hPt; hPt = tmp;
      }
      activeWidthPt = wPt;
      activeHeightPt = hPt;
      if (s.marginsUm) {
        activeMarginLeftPt = pt(s.marginsUm.left);
        activeMarginRightPt = pt(s.marginsUm.right);
      }
      activeMaxWidth = activeWidthPt - activeMarginLeftPt - activeMarginRightPt;
      lines.push({
        segments: [{ kind: "rule", widthPt: 0 }],
        yPt: 0,
        sizePt: 11,
        align: "left",
        style: `section-break ${JSON.stringify(b.settings ?? {})}`,
      });
    } else if (b.type === "table-of-contents") {
      const maxDepth = b.maxDepth ?? 3;
      const leaderStyle = b.leaderStyle ?? "dots";
      const headings = doc.root.children.filter((c): c is HeadingNode => c.type === "heading" && c.level <= maxDepth);
      for (const h of headings) {
        const title = (h.children ?? []).map((c) => (c.type === "text" ? c.text : "")).join("");
        const indent = (h.level - 1) * 16;
        lines.push({
          segments: [{ kind: "text", text: title, sizePt: 10, face: h.level === 1 ? "F4" : "F1" }],
          yPt: 0,
          sizePt: 10,
          align: "left",
          style: `toc-entry ${h.id} ${h.level} ${indent} ${leaderStyle}`,
        });
      }
    } else if (b.type === "image") {
      const align = b.align === "center" || b.align === "right" ? b.align : "left";
      lines.push({
        segments: [{ kind: "text", text: "", sizePt: 0 }],
        yPt: 0, sizePt: 11, align, style: `image ${b.assetId} ${b.widthUm ?? 0} ${b.heightUm ?? 0}`,
      });
    } else if (b.type === "code-block") {
      const code = b.code ?? "";
      const codeLines = code.split("\n");
      const showLineNumbers = b.showLineNumbers !== false;
      const lineStart = b.lineStart ?? 1;

      for (let i = 0; i < codeLines.length; i++) {
        const lineNum = lineStart + i;
        const lineText = codeLines[i]!;
        const tokens = tokenizeLine(lineText, b.language);
        const segs: Segment[] = [];

        if (showLineNumbers) {
          segs.push({
            kind: "text",
            text: `${String(lineNum).padStart(3, " ")} `,
            sizePt: 9,
            face: "F1",
            color: "#94a3b8",
          });
        }

        for (const t of tokens) {
          segs.push({
            kind: "text",
            text: t.text,
            sizePt: 9,
            face: t.kind === "keyword" ? "F4" : "F1",
            color: t.colorHex,
          });
        }

        lines.push({
          segments: segs,
          yPt: 0,
          sizePt: 9,
          align: "left",
          style: `code-line ${b.id}_${i}`,
        });
      }
    }
  }

  let curWidthPt = pageWidthPt;
  let curHeightPt = pageHeightPt;
  let curMarginLeftPt = marginPt;
  let curMarginRightPt = m.marginRightPt;
  let curMarginTopPt = m.marginTopPt;
  let curMarginBottomPt = bottomPt;
  let curEffectiveTopPt = effectiveTopPt;
  let curEffectiveBottomPt = effectiveBottomPt;
  let curSectionPageNum: number | undefined;
  let curHeadings: PdfHeadingAnchor[] = [];
  let curTocLinks: PdfTocLink[] = [];

  const pageOf = (rows: PdfPage["lines"]): PdfPage => {
    const pNum = curSectionPageNum !== undefined ? curSectionPageNum++ : undefined;
    return {
      lines: rows,
      widthPt: curWidthPt,
      heightPt: curHeightPt,
      marginPt: curMarginLeftPt,
      marginRightPt: curMarginRightPt,
      pageNumber: pNum,
      headings: curHeadings,
      tocLinks: curTocLinks,
    };
  };

  let curFootnotes: Array<{ id: string; mark: string; text: string }> = [];
  let curFootnoteReservePt = 0;

  const flushFootnotesToCur = (): void => {
    if (curFootnotes.length > 0) {
      const dividerY = curEffectiveBottomPt + curFootnotes.length * 16 + 4;
      cur.push({
        line: {
          segments: [{ kind: "rule", widthPt: 141.7 }],
          yPt: 0,
          sizePt: 10,
          align: "left",
          style: "footnote-divider",
        },
        yPt: dividerY,
      });
      for (let i = 0; i < curFootnotes.length; i++) {
        const fn = curFootnotes[i]!;
        const fnY = curEffectiveBottomPt + (curFootnotes.length - 1 - i) * 16;
        cur.push({
          line: {
            segments: [{ kind: "text", text: `${fn.mark}  ${fn.text}`, sizePt: 9, face: "F1" }],
            yPt: 0,
            sizePt: 9,
            align: "left",
            style: `footnote ${fn.id}`,
          },
          yPt: fnY,
        });
      }
    }
  };

  const pages: PdfPage[] = [];
  let cur: Array<{ line: PdfLine; yPt: number }> = [];
  let y = curHeightPt - curEffectiveTopPt;
  const startPage = (): void => {
    if (!cur.length) return;
    flushFootnotesToCur();
    pages.push(pageOf(cur));
    cur = [];
    curHeadings = [];
    curTocLinks = [];
    curFootnotes = [];
    curFootnoteReservePt = 0;
    y = curHeightPt - curEffectiveTopPt;
  };
  const need = (heightPt: number): void => {
    if (heightPt <= 0 || !cur.length) return;
    if (y - heightPt < curEffectiveBottomPt + curFootnoteReservePt) startPage();
  };
  let tableRow = -1;
  for (const line of lines) {
    const fnMatch = line.style.match(/fn:([^:]+):([^:]+):([^\s]+)/g);
    if (fnMatch) {
      for (const m of fnMatch) {
        const parts = m.split(":");
        const fnId = parts[1]!;
        const mark = decodeURIComponent(parts[2]!);
        const text = decodeURIComponent(parts[3]!);
        if (!curFootnotes.some((x) => x.id === fnId)) {
          curFootnotes.push({ id: fnId, mark, text });
          curFootnoteReservePt += 18;
        }
      }
    }
    if (line.style === "page-break") {
      startPage();
      y = curHeightPt - curEffectiveTopPt;
      continue;
    }
    if (line.style.startsWith("section-break")) {
      startPage();
      const settingsStr = line.style.slice("section-break ".length);
      let s: SectionSettings = {};
      try { s = JSON.parse(settingsStr); } catch {}
      let wPt = s.widthUm ? pt(s.widthUm) : pageWidthPt;
      let hPt = s.heightUm ? pt(s.heightUm) : pageHeightPt;
      if (s.orientation === "landscape" && wPt < hPt) {
        const tmp = wPt; wPt = hPt; hPt = tmp;
      } else if (s.orientation === "portrait" && wPt > hPt) {
        const tmp = wPt; wPt = hPt; hPt = tmp;
      }
      curWidthPt = wPt;
      curHeightPt = hPt;
      if (s.marginsUm) {
        curMarginLeftPt = pt(s.marginsUm.left);
        curMarginRightPt = pt(s.marginsUm.right);
        curMarginTopPt = pt(s.marginsUm.top);
        curMarginBottomPt = pt(s.marginsUm.bottom);
      }
      curEffectiveTopPt = (hf?.header || hf?.firstPageHeader || hf?.evenPageHeader)
        ? Math.max(curMarginTopPt, headerDistPt + 16)
        : curMarginTopPt;
      curEffectiveBottomPt = (hf?.footer || hf?.firstPageFooter || hf?.evenPageFooter)
        ? Math.max(curMarginBottomPt, footerDistPt + 16)
        : curMarginBottomPt;
      if (s.restartPageNumbering) {
        curSectionPageNum = s.startPageNumber ?? 1;
      }
      y = curHeightPt - curEffectiveTopPt;
      continue;
    }
    if (line.style === "table-top") {
      cur.push({ line, yPt: y });
      continue;
    }
    if (line.style.startsWith("table-cell") || line.style.startsWith("flow-cell")) {
      const parts = line.style.split(" ");
      const ri = Number(parts[3]);
      const rowH = Number(parts[5]) || 30;
      if (ri !== tableRow) {
        need(rowH);
        tableRow = ri;
      }
      cur.push({ line, yPt: y });
      continue;
    }
    if (line.style === "table-bottom") {
      need(24);
      cur.push({ line, yPt: y });
      y -= 24;
    } else if (line.style.startsWith("table-row-end")) {
      const rowH = Number(line.style.split(" ")[1]) || 30;
      cur.push({ line, yPt: y });
      y -= rowH;
      tableRow = -1;
    } else if (line.style.startsWith("image ")) {
      const parts = line.style.split(" ");
      const usableW = curWidthPt - curMarginLeftPt - curMarginRightPt;
      const usableH = curHeightPt - curEffectiveTopPt - curEffectiveBottomPt;
      const { hPt } = pdfImageDisplayPt(Number(parts[2]) || 0, Number(parts[3]) || 0, usableW, usableH);
      const cost = hPt + 13;
      need(cost);
      cur.push({ line, yPt: y });
      y -= cost;
    } else {
      const ext = lineVerticalExtent(line, 16);
      const paraGap = line.style.endsWith(" last") ? 4 : 2;
      const cost = ext.above + ext.below + paraGap;
      need(cost);
      y -= ext.above;
      cur.push({ line, yPt: y });
      if (line.style.startsWith("heading ")) {
        const parts = line.style.split(" ");
        const hId = parts[1]!;
        const hLevel = Number(parts[2]) || 1;
        const title = line.segments.map((s) => (s.kind === "text" ? s.text : "")).join("");
        curHeadings.push({ id: hId, title, level: hLevel, yPt: y });
      } else if (line.style.startsWith("toc-entry ")) {
        const parts = line.style.split(" ");
        const hId = parts[1]!;
        const indent = Number(parts[3]) || 0;
        const leftX = curMarginLeftPt + indent;
        const rightX = curWidthPt - curMarginRightPt;
        curTocLinks.push({
          rectPt: [leftX, y - 2, rightX, y + 12],
          headingId: hId,
        });
      }
      y -= ext.below + paraGap;
    }
  }
  if (cur.length) {
    flushFootnotesToCur();
    pages.push(pageOf(cur));
  }
  if (pages.length === 0) pages.push(pageOf([]));

  // Cross-reference TOC entries with resolved heading page numbers
  const headingPageMap = new Map<string, number>();
  pages.forEach((page, idx) => {
    const pNum = page.pageNumber ?? (idx + 1);
    for (const h of page.headings ?? []) {
      if (!headingPageMap.has(h.id)) {
        headingPageMap.set(h.id, pNum);
      }
    }
  });

  for (const page of pages) {
    for (const row of page.lines) {
      if (row.line.style.startsWith("toc-entry ")) {
        const parts = row.line.style.split(" ");
        const hId = parts[1]!;
        const targetPage = headingPageMap.get(hId) ?? 1;
        row.line.style = `${row.line.style} ${targetPage}`;
      }
    }
  }

  if (hf) {
    const totalPages = pages.length;
    const docTitle = (doc.metadata?.title as string) ?? "";
    const docDate = (doc.metadata?.date as string) ?? (doc.createdAt ? doc.createdAt.slice(0, 10) : "");

    pages.forEach((page, idx) => {
      const pageNum = page.pageNumber ?? (idx + 1);
      const isFirst = pageNum === 1;
      const isEven = pageNum % 2 === 0;
      const headerY = page.heightPt - headerDistPt;
      const footerY = footerDistPt;

      const hZone: HeaderFooterZone | undefined = (isFirst && hf.firstPageDifferent)
        ? hf.firstPageHeader
        : (isEven && hf.oddEvenDifferent ? (hf.evenPageHeader ?? hf.header) : hf.header);
      const fZone: HeaderFooterZone | undefined = (isFirst && hf.firstPageDifferent)
        ? hf.firstPageFooter
        : (isEven && hf.oddEvenDifferent ? (hf.evenPageFooter ?? hf.footer) : hf.footer);

      const vars = {
        pageNumber: pageNum,
        totalPages,
        documentTitle: docTitle,
        date: docDate,
      };

      const addZoneLines = (zone: HeaderFooterZone | undefined, yPt: number, kind: "header" | "footer") => {
        if (!zone) return;
        const addSide = (nodes: InlineNode[] | undefined, align: "left" | "center" | "right") => {
          if (!nodes || !nodes.length) return;
          const resolved = resolveDynamicVariables(nodes, vars);
          const segs = inlineToSegments(resolved as never, 9);
          if (segs.length) {
            page.lines.push({
              line: {
                segments: segs,
                yPt,
                sizePt: 9,
                align,
                style: `running-${kind} ${kind}-${align}`,
              },
              yPt,
            });
          }
        };
        addSide(zone.left, "left");
        addSide(zone.center, "center");
        addSide(zone.right, "right");
      };

      addZoneLines(hZone, headerY, "header");
      addZoneLines(fZone, footerY, "footer");
    });
  }

  return pages;
}
