import type { PortableDocument } from "../../core/model/types.js";

/** Print points from document page (same numbers for layout + MediaBox). */
export function pdfPageMetrics(doc: PortableDocument): {
  widthPt: number;
  heightPt: number;
  marginTopPt: number;
  marginRightPt: number;
  marginBottomPt: number;
  marginLeftPt: number;
} {
  const pt = (um: number): number => Math.round((um / 25400) * 72);
  const p = doc.page;
  return {
    widthPt: pt(p.widthUm),
    heightPt: pt(p.heightUm),
    marginTopPt: pt(p.marginUm.top),
    marginRightPt: pt(p.marginUm.right),
    marginBottomPt: pt(p.marginUm.bottom),
    marginLeftPt: pt(p.marginUm.left),
  };
}
