/**
 * Pagination — Phase 6.2
 * Vertical flow, forced breaks, basic widows/orphans, image size diagnostics, deterministic output.
 */
import type { HeaderFooterZone, PortableDocument } from "../../core/model/types.js";
import { getFontMetrics } from "./text.js";
import { layoutBlock } from "./layout-blocks.js";
import type { LayoutFlow } from "./layout-flow.js";
export type { LayoutPage, PageBox, PaginationOptions, PaginationResult } from "./layout-types.js";
import type { LayoutPage, PageBox, PaginationOptions, PaginationResult } from "./layout-types.js";
import { resolveDynamicVariables, inlineNodesToText } from "./dynamic-vars.js";

export function paginateDocument(doc: PortableDocument, opts: PaginationOptions = {}): PaginationResult {
  const diagnostics: PaginationResult["diagnostics"] = [];
  const pageWidthUm = doc.page.widthUm;
  const pageHeightUm = doc.page.heightUm;
  const margin = doc.page.marginUm;
  const usableWidthUm = pageWidthUm - margin.left - margin.right;

  // Pass 1: Compute usable bounds taking running header/footer into account
  const hf = doc.page.headerFooter;
  const headerDistUm = hf?.headerDistanceUm ?? 12700;
  const footerDistUm = hf?.footerDistanceUm ?? 12700;
  const headerHeightUm = 4500;
  const footerHeightUm = 4500;

  const effectiveTopUm = (hf?.header || hf?.firstPageHeader || hf?.evenPageHeader)
    ? Math.max(margin.top, headerDistUm + headerHeightUm)
    : margin.top;
  const effectiveBottomUm = (hf?.footer || hf?.firstPageFooter || hf?.evenPageFooter)
    ? Math.max(margin.bottom, footerDistUm + footerHeightUm)
    : margin.bottom;

  const usableHeightUm = pageHeightUm - effectiveTopUm - effectiveBottomUm;
  const lineHeightDefault = getFontMetrics({ text: "x" }).lineHeightUm;
  const pages: LayoutPage[] = [];
  const flowMargin = { ...margin, top: effectiveTopUm, bottom: effectiveBottomUm };

  const flow: LayoutFlow = {
    opts,
    diagnostics,
    margin: flowMargin,
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
    cursorY: effectiveTopUm,
  };

  for (const block of doc.root.children) layoutBlock(flow, block);

  if (flow.currentPage.boxes.length > 0 || pages.length === 0) pages.push(flow.currentPage);

  // Pass 2: Decorate running headers and footers with resolved dynamic variables
  if (hf) {
    const totalPages = pages.length;
    const docTitle = (doc.metadata?.title as string) ?? "";
    const docDate = (doc.metadata?.date as string) ?? (doc.createdAt ? doc.createdAt.slice(0, 10) : "");

    pages.forEach((p, idx) => {
      const pageNum = idx + 1;
      const isFirst = pageNum === 1;
      const isEven = pageNum % 2 === 0;

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

      p.headerBoxes = [];
      p.footerBoxes = [];

      const makeBoxes = (zone: HeaderFooterZone | undefined, yUm: number, target: PageBox[], type: "header" | "footer") => {
        if (!zone) return;
        if (zone.left?.length) {
          const resolved = resolveDynamicVariables(zone.left, vars);
          target.push({
            id: `${type}_left_${pageNum}`,
            type: `${type}-left`,
            xUm: margin.left,
            yUm,
            widthUm: usableWidthUm,
            heightUm: headerHeightUm,
            content: inlineNodesToText(resolved),
          });
        }
        if (zone.center?.length) {
          const resolved = resolveDynamicVariables(zone.center, vars);
          target.push({
            id: `${type}_center_${pageNum}`,
            type: `${type}-center`,
            xUm: margin.left,
            yUm,
            widthUm: usableWidthUm,
            heightUm: headerHeightUm,
            content: inlineNodesToText(resolved),
          });
        }
        if (zone.right?.length) {
          const resolved = resolveDynamicVariables(zone.right, vars);
          target.push({
            id: `${type}_right_${pageNum}`,
            type: `${type}-right`,
            xUm: margin.left,
            yUm,
            widthUm: usableWidthUm,
            heightUm: headerHeightUm,
            content: inlineNodesToText(resolved),
          });
        }
      };

      makeBoxes(hZone, headerDistUm, p.headerBoxes, "header");
      makeBoxes(fZone, pageHeightUm - footerDistUm - footerHeightUm, p.footerBoxes, "footer");
    });
  }

  const hash = `layout_${pages.length}_${pages.reduce((n, p) => n + p.boxes.length, 0)}`;
  return { pages, diagnostics, hash };
}
