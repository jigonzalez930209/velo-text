import type { BlockNode } from "../../core/model/types.js";
import { breakLines } from "./text.js";
import { box, ensureSpace, pushPage, applySectionBreak, type LayoutFlow } from "./layout-flow.js";

export function layoutStructuredBlock(flow: LayoutFlow, block: BlockNode): boolean {
  const { margin, usableWidthUm, usableHeightUm, lineHeightDefault, diagnostics } = flow;
  if (block.type === "table") {
    const colCount = block.columns.length;
    const colWidth = Math.floor(usableWidthUm / Math.max(1, colCount));
    const headerHeight = lineHeightDefault * 1.2;
    for (let ri = 0; ri < block.rows.length; ri++) {
      const row = block.rows[ri]!;
      let rowHeight = headerHeight;
      for (const cell of row.cells) {
        for (const b of cell.blocks) {
          if (b.type === "paragraph") {
            const txt = (b.children ?? []).map((c) => (c as { text?: string }).text ?? "").join("");
            const lines = breakLines(txt, { maxWidthUm: colWidth - 2000 });
            rowHeight = Math.max(rowHeight, lines.length * lineHeightDefault + 800);
          }
        }
      }
      if (flow.cursorY + rowHeight > margin.top + usableHeightUm) {
        if (rowHeight > usableHeightUm) {
          diagnostics.push({
            code: "row-too-tall",
            message: `Table row ${row.id} height ${rowHeight} exceeds usable height ${usableHeightUm}`,
            severity: "warn",
          });
        }
        pushPage(flow);
        if (ri > 0 && block.rows[0]!.header) {
          flow.currentPage.boxes.push(box({
            id: `${block.id}_header_repeat`,
            type: "table-header",
            xUm: margin.left,
            yUm: flow.cursorY,
            widthUm: usableWidthUm,
            heightUm: headerHeight,
            content: "Header repeat",
          }));
          flow.cursorY += headerHeight;
        }
      }
      flow.currentPage.boxes.push(box({
        id: row.id,
        type: "table-row",
        xUm: margin.left,
        yUm: flow.cursorY,
        widthUm: usableWidthUm,
        heightUm: rowHeight,
        content: `row ${ri}`,
      }));
      flow.cursorY += rowHeight;
    }
    flow.cursorY += Math.round(lineHeightDefault * 0.4);
    return true;
  }
  if (block.type === "columns") {
    const n = Math.max(1, block.columns.length);
    const gap = block.gapUm ?? 4000;
    const colW = Math.floor((usableWidthUm - gap * (n - 1)) / n);
    let maxH = 0;
    for (let i = 0; i < n; i++) {
      const col = block.columns[i]!;
      let h = 0;
      for (const b of col.blocks) {
        if (b.type === "paragraph" || b.type === "heading" || b.type === "quote") {
          const txt = (b.children ?? [])
            .map((c) => (c as { text?: string; source?: string }).text ?? (c as { source?: string }).source ?? "")
            .join("");
          const lines = breakLines(txt, { maxWidthUm: colW - 1000 });
          h += lines.length * lineHeightDefault + Math.round(lineHeightDefault * 0.2);
        } else if (b.type === "image") {
          h += b.heightUm ?? 30_000;
        } else {
          h += lineHeightDefault * 2;
        }
      }
      maxH = Math.max(maxH, h);
    }
    ensureSpace(flow, maxH);
    flow.currentPage.boxes.push(box({
      id: block.id,
      type: "columns",
      xUm: margin.left,
      yUm: flow.cursorY,
      widthUm: usableWidthUm,
      heightUm: maxH,
      content: `${n} columns`,
    }));
    flow.cursorY += maxH + Math.round(lineHeightDefault * 0.3);
    return true;
  }
  if (block.type === "image") {
    const w = block.widthUm ?? 50_000;
    const h = block.heightUm ?? 30_000;
    if (w > usableWidthUm || h > usableHeightUm) {
      diagnostics.push({
        code: "image-too-large",
        message: `Image ${block.id} ${w}x${h} exceeds usable ${usableWidthUm}x${usableHeightUm}`,
        severity: "warn",
      });
    }
    ensureSpace(flow, h);
    flow.currentPage.boxes.push(box({
      id: block.id,
      type: "image",
      xUm: margin.left,
      yUm: flow.cursorY,
      widthUm: Math.min(w, usableWidthUm),
      heightUm: h,
      content: (block as unknown as { assetId: string }).assetId,
    }));
    flow.cursorY += h + Math.round(lineHeightDefault * 0.3);
    return true;
  }
  if (block.type === "equation-block") {
    const h = lineHeightDefault * 1.6;
    ensureSpace(flow, h);
    flow.currentPage.boxes.push(box({
      id: block.id,
      type: "equation-block",
      xUm: margin.left,
      yUm: flow.cursorY,
      widthUm: usableWidthUm,
      heightUm: h,
      content: (block as unknown as { latex: string }).latex,
    }));
    flow.cursorY += h + Math.round(lineHeightDefault * 0.4);
    return true;
  }
  if (block.type === "page-break") {
    pushPage(flow);
    return true;
  }
  if (block.type === "section-break") {
    applySectionBreak(flow, block.settings);
    return true;
  }
  if (block.type === "horizontal-rule") {
    ensureSpace(flow, lineHeightDefault);
    flow.currentPage.boxes.push(box({
      id: block.id,
      type: "horizontal-rule",
      xUm: margin.left,
      yUm: flow.cursorY,
      widthUm: usableWidthUm,
      heightUm: 400,
      content: "---",
    }));
    flow.cursorY += 800;
    return true;
  }
  return false;
}
