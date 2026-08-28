import type { BlockNode, InlineNode, PortableDocument } from "../../core/model/types.js";

export interface OutlineEntry {
  id: string;
  level: 1 | 2 | 3;
  text: string;
}

function inlineText(nodes: InlineNode[]): string {
  return nodes.map((n) => {
    if (n.type === "text") return n.text;
    if (n.type === "variable") return n.source;
    if (n.type === "link") return inlineText(n.children as InlineNode[]);
    return "";
  }).join("");
}

function walk(blocks: BlockNode[], out: OutlineEntry[]): void {
  for (const b of blocks) {
    if (b.type === "heading" && b.level <= 3) {
      out.push({ id: b.id, level: b.level as 1 | 2 | 3, text: inlineText(b.children).trim() || "Untitled" });
    } else if (b.type === "table") {
      for (const row of b.rows) for (const cell of row.cells) walk(cell.blocks, out);
    } else if (b.type === "columns") {
      for (const col of b.columns) walk(col.blocks, out);
    }
  }
}

export function collectOutline(doc: PortableDocument): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  walk(doc.root.children, out);
  return out;
}

export function focusBlockEl(container: HTMLElement, id: string): boolean {
  const el = container.querySelector(`[data-node-id="${id.replace(/"/g, "")}"]`) as HTMLElement | null;
  if (!el) return false;
  el.scrollIntoView?.({ block: "center" });
  const sel = container.ownerDocument.getSelection();
  const range = container.ownerDocument.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(range);
  el.focus?.();
  container.focus();
  return true;
}
