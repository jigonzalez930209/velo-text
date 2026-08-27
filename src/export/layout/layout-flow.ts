import type { LayoutPage, PageBox, PaginationOptions, PaginationResult } from "./layout-types.js";

export interface LayoutFlow {
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
}

export function pushPage(flow: LayoutFlow): void {
  flow.pages.push(flow.currentPage);
  flow.currentPage = {
    index: flow.pages.length,
    widthUm: flow.pageSize.widthUm,
    heightUm: flow.pageSize.heightUm,
    usableWidthUm: flow.usableWidthUm,
    usableHeightUm: flow.usableHeightUm,
    boxes: [],
  };
  flow.cursorY = flow.margin.top;
}

export function ensureSpace(flow: LayoutFlow, neededHeightUm: number): boolean {
  if (flow.cursorY + neededHeightUm > flow.margin.top + flow.usableHeightUm) {
    pushPage(flow);
    return true;
  }
  return false;
}

export function box(partial: PageBox): PageBox {
  return partial;
}
