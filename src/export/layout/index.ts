import type { PortableDocument } from "../../core/model/types.js";

export interface LayoutPage {
  index: number;
  widthUm: number;
  heightUm: number;
  boxes: LayoutBox[];
}

export interface LayoutBox {
  type: string;
  xUm: number;
  yUm: number;
  widthUm: number;
  heightUm: number;
  content?: string;
}

export interface LayoutModel {
  pages: LayoutPage[];
  diagnostics: Array<{ code: string; message: string }>;
  hash: string;
}

/**
 * Intermediate layout model — Phase 6
 * Trivial block layout for now; pagination and font metrics will come later.
 */
export function buildLayout(doc: PortableDocument, _assets: Record<string, unknown> = {}, _opts: Record<string, unknown> = {}): LayoutModel {
  const pages: LayoutPage[] = [{
    index: 0,
    widthUm: doc.page.widthUm,
    heightUm: doc.page.heightUm,
    boxes: doc.root.children.map((b, i) => ({
      type: b.type,
      xUm: doc.page.marginUm.left,
      yUm: doc.page.marginUm.top + i * 10000,
      widthUm: doc.page.widthUm - doc.page.marginUm.left - doc.page.marginUm.right,
      heightUm: 8000,
      content: b.id,
    })),
  }];
  return { pages, diagnostics: [], hash: "layout_v0" };
}
