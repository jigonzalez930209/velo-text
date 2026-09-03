import type { PortableDocument, SectionSettings } from "../../core/model/types.js";
import type { LayoutPage, PageBox, PaginationOptions, PaginationResult } from "./layout-types.js";

export interface LayoutFlow {
  doc?: PortableDocument;
  opts: PaginationOptions;
  diagnostics: PaginationResult["diagnostics"];
  margin: { top: number; left: number; right: number; bottom: number };
  usableWidthUm: number;
  usableHeightUm: number;
  lineHeightDefault: number;
  pages: LayoutPage[];
  pageSize: { widthUm: number; heightUm: number };
  currentPage: LayoutPage;
  cursorY: number;
  currentSectionPageNumber?: number;
  footnoteReserveUm?: number;
}

export function pushPage(flow: LayoutFlow): void {
  flow.pages.push(flow.currentPage);
  const nextSectionNum = flow.currentSectionPageNumber !== undefined ? flow.currentSectionPageNumber + 1 : undefined;
  flow.currentSectionPageNumber = nextSectionNum;
  flow.footnoteReserveUm = 0;
  flow.currentPage = {
    index: flow.pages.length,
    pageNumber: nextSectionNum,
    widthUm: flow.pageSize.widthUm,
    heightUm: flow.pageSize.heightUm,
    usableWidthUm: flow.usableWidthUm,
    usableHeightUm: flow.usableHeightUm,
    boxes: [],
  };
  flow.cursorY = flow.margin.top;
}

export function applySectionBreak(flow: LayoutFlow, settings?: SectionSettings): void {
  if (flow.currentPage.boxes.length > 0) {
    flow.pages.push(flow.currentPage);
  }
  if (settings) {
    let widthUm = settings.widthUm ?? flow.pageSize.widthUm;
    let heightUm = settings.heightUm ?? flow.pageSize.heightUm;
    if (settings.orientation === "landscape" && widthUm < heightUm) {
      const tmp = widthUm;
      widthUm = heightUm;
      heightUm = tmp;
    } else if (settings.orientation === "portrait" && widthUm > heightUm) {
      const tmp = widthUm;
      widthUm = heightUm;
      heightUm = tmp;
    }
    flow.pageSize = { widthUm, heightUm };
    if (settings.marginsUm) {
      flow.margin = { ...flow.margin, ...settings.marginsUm };
    }
    flow.usableWidthUm = flow.pageSize.widthUm - flow.margin.left - flow.margin.right;
    flow.usableHeightUm = flow.pageSize.heightUm - flow.margin.top - flow.margin.bottom;
    if (settings.restartPageNumbering) {
      flow.currentSectionPageNumber = settings.startPageNumber ?? 1;
    }
  }
  flow.footnoteReserveUm = 0;
  flow.currentPage = {
    index: flow.pages.length,
    pageNumber: flow.currentSectionPageNumber,
    widthUm: flow.pageSize.widthUm,
    heightUm: flow.pageSize.heightUm,
    usableWidthUm: flow.usableWidthUm,
    usableHeightUm: flow.usableHeightUm,
    boxes: [],
  };
  flow.cursorY = flow.margin.top;
}

export function ensureSpace(flow: LayoutFlow, neededHeightUm: number): boolean {
  const reserve = flow.footnoteReserveUm ?? 0;
  if (flow.cursorY + neededHeightUm > flow.margin.top + flow.usableHeightUm - reserve) {
    pushPage(flow);
    return true;
  }
  return false;
}

export function box(partial: PageBox): PageBox {
  return partial;
}
