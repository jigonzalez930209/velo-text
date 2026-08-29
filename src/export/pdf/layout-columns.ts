import type { PortableDocument } from "../../core/model/types.js";
import { flattenWrapped, inlineToSegments, wrapSegs, wrappedBlockHeight } from "./layout-table.js";
import type { PdfLine, Segment } from "./pdf-model.js";

function packSlot(blocks: PortableDocument["root"]["children"]): { segs: Segment[]; img: { id: string; w: number; h: number } | null } {
  const segs: Segment[] = [];
  let img: { id: string; w: number; h: number } | null = null;
  const br = () => { if (segs.length) segs.push({ kind: "rule", widthPt: 0 }); };
  for (const bl of blocks) {
    if (bl.type === "image") { img = { id: bl.assetId, w: bl.widthUm ?? 0, h: bl.heightUm ?? 0 }; continue; }
    if (bl.type === "list") {
      for (const it of bl.items) {
        br();
        segs.push({ kind: "text", text: bl.kind === "ordered" ? "1. " : "•  ", sizePt: 11 });
        segs.push(...inlineToSegments(it.content as never, 11));
      }
    } else if (bl.type === "paragraph" || bl.type === "heading" || bl.type === "quote") {
      br();
      segs.push(...inlineToSegments(bl.children as never, bl.type === "heading" ? 12 : 11));
    }
  }
  return { segs, img };
}

export function emitColumns(
  lines: PdfLine[],
  block: { id: string; columns: Array<{ blocks: PortableDocument["root"]["children"]; widthPct?: number; vAlign?: string }> },
  maxWidth: number,
): void {
  const n = Math.max(2, block.columns.length);
  const gap = 8;
  const inner = Math.max(40, maxWidth - gap * (n - 1));
  const colW = block.columns.map((c) => ((c.widthPct ?? 100 / n) / 100) * inner);
  let h = 28;
  const packed: Segment[][] = [];
  const imgs: Array<{ id: string; w: number; h: number } | null> = [];
  for (let ci = 0; ci < block.columns.length; ci++) {
    const packedSlot = packSlot(block.columns[ci]!.blocks);
    const wrapped = wrapSegs(packedSlot.segs, Math.max(24, colW[ci]! - 10));
    h = Math.max(h, wrappedBlockHeight(wrapped, 16));
    if (packedSlot.img) h = Math.max(h, Math.min(120, (packedSlot.img.h / 25400) * 72) + 16);
    packed.push(flattenWrapped(wrapped));
    imgs.push(packedSlot.img);
  }
  for (let ci = 0; ci < block.columns.length; ci++) {
    const img = imgs[ci];
    const imgBits = img ? ` ${img.id} ${img.w} ${img.h}` : " - 0 0";
    const slot = block.columns[ci]!;
    const va = slot.vAlign === "middle" || slot.vAlign === "bottom" ? slot.vAlign : "top";
    const ha = (slot.blocks[0] as { align?: string } | undefined)?.align;
    lines.push({
      segments: packed[ci] ?? [],
      yPt: 0,
      sizePt: 9,
      align: ha === "center" || ha === "right" ? ha : "left",
      style: `flow-cell ${ci} ${block.id} 0 ${colW[ci]} ${h} ${gap}${imgBits} va-${va}`,
    });
  }
  lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: `table-row-end ${h}` });
  lines.push({ segments: [{ kind: "rule", widthPt: 0 }], yPt: 0, sizePt: 9, align: "left", style: "table-bottom" });
}
