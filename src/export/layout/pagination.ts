/**
 * Pagination — Phase 6.2
 * Vertical flow, forced breaks, basic widows/orphans, image size diagnostics, deterministic output.
 * No DOM dependency — runs identically in browser and backend.
 */
import type { PortableDocument, BlockNode } from "../../core/model/types.js";
import { breakLines, getFontMetrics, findMissingGlyphs } from "./text.js";

export interface PageBox {
  id: string;
  type: string;
  xUm: number;
  yUm: number;
  widthUm: number;
  heightUm: number;
  content?: string;
  lines?: Array<{ text: string; yUm: number }>;
}

export interface LayoutPage {
  index: number;
  widthUm: number;
  heightUm: number;
  usableWidthUm: number;
  usableHeightUm: number;
  boxes: PageBox[];
}

export interface PaginationOptions {
  // Allow injecting deterministic id generation or clock if needed
  widows?: number; // minimum lines of paragraph at bottom of page
  orphans?: number; // minimum lines at top of next page
}

export interface PaginationResult {
  pages: LayoutPage[];
  diagnostics: Array<{ code: string; message: string; severity: "warn" | "error" | "info" }>;
  hash: string; // per-layout hash (simple)
}

export function paginateDocument(doc: PortableDocument, opts: PaginationOptions = {}): PaginationResult {
  const diagnostics: PaginationResult["diagnostics"] = [];
  const pageWidthUm = doc.page.widthUm;
  const pageHeightUm = doc.page.heightUm;
  const margin = doc.page.marginUm;
  const usableWidthUm = pageWidthUm - margin.left - margin.right;
  const usableHeightUm = pageHeightUm - margin.top - margin.bottom;
  const lineHeightDefault = getFontMetrics({ text: "x" }).lineHeightUm;

  const pages: LayoutPage[] = [];
  let currentPage: LayoutPage = {
    index: 0,
    widthUm: pageWidthUm,
    heightUm: pageHeightUm,
    usableWidthUm,
    usableHeightUm,
    boxes: [],
  };
  let cursorY = margin.top;

  const pushPage = () => {
    pages.push(currentPage);
    currentPage = {
      index: pages.length,
      widthUm: pageWidthUm,
      heightUm: pageHeightUm,
      usableWidthUm,
      usableHeightUm,
      boxes: [],
    };
    cursorY = margin.top;
  };

  const ensureSpace = (neededHeightUm: number) => {
    if (cursorY + neededHeightUm > margin.top + usableHeightUm) {
      pushPage();
      return true;
    }
    return false;
  };

  const layoutBlock = (block: BlockNode) => {
    switch (block.type) {
      case "paragraph":
      case "heading":
      case "quote": {
        const text = (block.children ?? [])
          .map((c) => {
            if (c.type === "text") return c.text;
            if (c.type === "variable") return c.source;
            if (c.type === "equation") return `$${(c as unknown as { latex: string }).latex}$`;
            if (c.type === "hard-break") return "\n";
            return "";
          })
          .join("");
        const fontSizePt = block.type === "heading" ? 14 + (6 - (block as unknown as { level: number }).level) : 11;
        const lines = breakLines(text, { maxWidthUm: usableWidthUm, defaultFontSizePt: fontSizePt });
        const missing = findMissingGlyphs(text);
        if (missing.length) diagnostics.push({ code: "missing-glyph", message: `Missing glyphs: ${missing.slice(0, 5).join("")}`, severity: "warn" });

        // Widows/orphans: if paragraph has 3+ lines and would split with 1 line on page, push whole paragraph
        const widows = opts.widows ?? 2;
        const orphans = opts.orphans ?? 2;
        const paraHeight = lines.length * lineHeightDefault;
        const wouldSplit = cursorY + paraHeight > margin.top + usableHeightUm;
        const linesOnCurrentPage = Math.floor((margin.top + usableHeightUm - cursorY) / lineHeightDefault);

        if (wouldSplit && linesOnCurrentPage < widows && lines.length >= widows + orphans) {
          // Not enough room for widows — push to next page
          pushPage();
        }

        for (let i = 0; i < lines.length; i++) {
          ensureSpace(lineHeightDefault);
          const line = lines[i]!;
          currentPage.boxes.push({
            id: `${block.id}_line_${i}`,
            type: block.type,
            xUm: margin.left,
            yUm: cursorY,
            widthUm: usableWidthUm,
            heightUm: lineHeightDefault,
            content: line.text,
          });
          cursorY += lineHeightDefault;
        }
        // Paragraph spacing
        cursorY += Math.round(lineHeightDefault * 0.3);
        break;
      }
      case "list": {
        for (const item of block.items) {
          const text = item.content
            .map((c) => {
              const cc = c as unknown as { text?: string; source?: string; latex?: string; type: string };
              if (cc.type === "equation") return `$${cc.latex}$`;
              return cc.text ?? cc.source ?? "";
            })
            .join("");
          const prefix = block.kind === "ordered" ? "1. " : "• ";
          const lines = breakLines(prefix + text, { maxWidthUm: usableWidthUm });
          for (const line of lines) {
            ensureSpace(lineHeightDefault);
            currentPage.boxes.push({
              id: `${item.id}_line`,
              type: "list-item",
              xUm: margin.left,
              yUm: cursorY,
              widthUm: usableWidthUm,
              heightUm: lineHeightDefault,
              content: line.text,
            });
            cursorY += lineHeightDefault;
          }
          if (item.nested) layoutBlock(item.nested as unknown as BlockNode);
        }
        cursorY += Math.round(lineHeightDefault * 0.2);
        break;
      }
      case "table": {
        // Simple table layout: each row is a set of boxes stacked vertically; columns share usableWidth equally
        const colCount = block.columns.length;
        const colWidth = Math.floor(usableWidthUm / Math.max(1, colCount));
        const headerHeight = lineHeightDefault * 1.2;
        for (let ri = 0; ri < block.rows.length; ri++) {
          const row = block.rows[ri]!;
          // Estimate row height as max cell block height
          let rowHeight = headerHeight;
          // For MVP, each cell's first block determines height
          for (const cell of row.cells) {
            for (const b of cell.blocks) {
              if (b.type === "paragraph") {
                const txt = (b.children ?? []).map((c) => (c as { text?: string }).text ?? "").join("");
                const lines = breakLines(txt, { maxWidthUm: colWidth - 2000 });
                rowHeight = Math.max(rowHeight, lines.length * lineHeightDefault + 800);
              }
            }
          }
          // Check if row fits; if not, paginate — but do not split row across pages in v1 (diagnostic)
          if (cursorY + rowHeight > margin.top + usableHeightUm) {
            if (rowHeight > usableHeightUm) {
              diagnostics.push({
                code: "row-too-tall",
                message: `Table row ${row.id} height ${rowHeight} exceeds usable height ${usableHeightUm}`,
                severity: "warn",
              });
            }
            pushPage();
            // Repeat header if this table has a header row and we're not on first page of table
            if (ri > 0 && block.rows[0]!.header) {
              // Re-emit header row as extra box (simplified)
              currentPage.boxes.push({
                id: `${block.id}_header_repeat`,
                type: "table-header",
                xUm: margin.left,
                yUm: cursorY,
                widthUm: usableWidthUm,
                heightUm: headerHeight,
                content: "Header repeat",
              });
              cursorY += headerHeight;
            }
          }
          currentPage.boxes.push({
            id: row.id,
            type: "table-row",
            xUm: margin.left,
            yUm: cursorY,
            widthUm: usableWidthUm,
            heightUm: rowHeight,
            content: `row ${ri}`,
          });
          cursorY += rowHeight;
        }
        cursorY += Math.round(lineHeightDefault * 0.4);
        break;
      }
      case "image": {
        const w = block.widthUm ?? 50_000;
        const h = block.heightUm ?? 30_000;
        if (w > usableWidthUm || h > usableHeightUm) {
          diagnostics.push({
            code: "image-too-large",
            message: `Image ${block.id} ${w}x${h} exceeds usable ${usableWidthUm}x${usableHeightUm}`,
            severity: "warn",
          });
        }
        ensureSpace(h);
        currentPage.boxes.push({
          id: block.id,
          type: "image",
          xUm: margin.left,
          yUm: cursorY,
          widthUm: Math.min(w, usableWidthUm),
          heightUm: h,
          content: (block as unknown as { assetId: string }).assetId,
        });
        cursorY += h + Math.round(lineHeightDefault * 0.3);
        break;
      }
      case "equation-block": {
        const h = lineHeightDefault * 1.6;
        ensureSpace(h);
        currentPage.boxes.push({
          id: block.id,
          type: "equation-block",
          xUm: margin.left,
          yUm: cursorY,
          widthUm: usableWidthUm,
          heightUm: h,
          content: (block as unknown as { latex: string }).latex,
        });
        cursorY += h + Math.round(lineHeightDefault * 0.4);
        break;
      }
      case "page-break":
        pushPage();
        break;
      case "horizontal-rule": {
        ensureSpace(lineHeightDefault);
        currentPage.boxes.push({
          id: block.id,
          type: "horizontal-rule",
          xUm: margin.left,
          yUm: cursorY,
          widthUm: usableWidthUm,
          heightUm: 400,
          content: "---",
        });
        cursorY += 800;
        break;
      }
      default:
        diagnostics.push({ code: "unknown-block", message: `Unknown block type ${(block as { type: string }).type}`, severity: "warn" });
    }
  };

  for (const block of doc.root.children) layoutBlock(block);

  if (currentPage.boxes.length > 0 || pages.length === 0) pages.push(currentPage);

  // Deterministic hash per layout — simple JSON hash of page structure (excluding diagnostics)
  const hash = `layout_${pages.length}_${pages.reduce((n, p) => n + p.boxes.length, 0)}`;

  return { pages, diagnostics, hash };
}
