import type { BlockNode, PortableDocument } from "../core/model/types.js";
import type { InlineNode } from "../core/model/inline.js";
import type { DocumentSlot, SlotKind } from "./types.js";

function slot(
  kind: SlotKind,
  id: string,
  pointer: string,
  tag: string,
  extra: Partial<DocumentSlot> = {},
): DocumentSlot {
  return { id, kind, pointer, tag, ...extra };
}

function walkInlines(nodes: InlineNode[], pointer: string, out: DocumentSlot[]): void {
  nodes.forEach((n, i) => {
    const p = `${pointer}/${i}`;
    if (n.type === "variable") {
      out.push(slot("variable", n.id, p, n.path, { path: n.path, format: n.format, fallback: n.fallback }));
    } else if (n.type === "inline-image") {
      out.push(slot("inline-image", n.id, p, n.assetId, { assetId: n.assetId }));
    } else if (n.type === "equation") {
      out.push(slot("equation", n.id, p, n.id, { latex: n.latex }));
    } else if (n.type === "link") {
      walkInlines(n.children, `${p}/children`, out);
    }
  });
}

function walkBlocks(blocks: BlockNode[], pointer: string, out: DocumentSlot[]): void {
  blocks.forEach((b, i) => {
    const p = `${pointer}/${i}`;
    switch (b.type) {
      case "paragraph":
      case "heading":
      case "quote":
        walkInlines(b.children, `${p}/children`, out);
        break;
      case "list":
        b.items.forEach((it, j) => {
          walkInlines(it.content, `${p}/items/${j}/content`, out);
          if (it.nested) walkBlocks([it.nested], `${p}/items/${j}/nested`, out);
        });
        break;
      case "table": {
        const tag = b.repeat?.path ?? b.id;
        out.push(slot("table", b.id, p, tag, b.repeat ? { repeat: { path: b.repeat.path, alias: b.repeat.alias } } : {}));
        if (b.repeat) {
          out.push(slot("table-repeat", b.id, `${p}/repeat`, b.repeat.path, {
            repeat: { path: b.repeat.path, alias: b.repeat.alias },
          }));
        }
        b.rows.forEach((row, r) => {
          row.cells.forEach((cell, c) => walkBlocks(cell.blocks, `${p}/rows/${r}/cells/${c}/blocks`, out));
        });
        break;
      }
      case "image":
        out.push(slot("image", b.id, p, b.assetId, { assetId: b.assetId }));
        break;
      case "equation-block":
        out.push(slot("equation-block", b.id, p, b.id, { latex: b.latex }));
        break;
      case "columns":
        out.push(slot("columns", b.id, p, b.id));
        b.columns.forEach((col, c) => walkBlocks(col.blocks, `${p}/columns/${c}/blocks`, out));
        break;
      default:
        break;
    }
  });
}

/** Slots the backend must fill. Same tags as `data-node-type` / variable `path` / `assetId`. */
export function reportSlots(doc: PortableDocument): DocumentSlot[] {
  const out: DocumentSlot[] = [];
  walkBlocks(doc.root.children, "/root/children", out);
  return out;
}
