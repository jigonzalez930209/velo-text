/**
 * Pagination — Phase 6.2
 * Vertical flow, forced breaks, basic widows/orphans, image size diagnostics, deterministic output.
 */
import type { PortableDocument } from "../../core/model/types.js";
import { getFontMetrics } from "./text.js";
import { layoutBlock } from "./layout-blocks.js";
import type { LayoutFlow } from "./layout-flow.js";
export type { LayoutPage, PageBox, PaginationOptions, PaginationResult } from "./layout-types.js";
import type { LayoutPage, PaginationOptions, PaginationResult } from "./layout-types.js";

export function paginateDocument(doc: PortableDocument, opts: PaginationOptions = {}): PaginationResult {
  const diagnostics: PaginationResult["diagnostics"] = [];
  const pageWidthUm = doc.page.widthUm;
  const pageHeightUm = doc.page.heightUm;
  const margin = doc.page.marginUm;
  const usableWidthUm = pageWidthUm - margin.left - margin.right;
  const usableHeightUm = pageHeightUm - margin.top - margin.bottom;
  const lineHeightDefault = getFontMetrics({ text: "x" }).lineHeightUm;
  const pages: LayoutPage[] = [];
  const flow: LayoutFlow = {
    opts,
    diagnostics,
    margin,
    usableWidthUm,
    usableHeightUm,
    lineHeightDefault,
    pages,
    pageSize: { widthUm: pageWidthUm, heightUm: pageHeightUm },
    currentPage: {
      index: 0,
      widthUm: pageWidthUm,
      heightUm: pageHeightUm,
      usableWidthUm,
      usableHeightUm,
      boxes: [],
    },
    cursorY: margin.top,
  };

  for (const block of doc.root.children) layoutBlock(flow, block);

  if (flow.currentPage.boxes.length > 0 || pages.length === 0) pages.push(flow.currentPage);

  const hash = `layout_${pages.length}_${pages.reduce((n, p) => n + p.boxes.length, 0)}`;
  return { pages, diagnostics, hash };
}
