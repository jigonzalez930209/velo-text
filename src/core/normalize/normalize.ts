/**
 * Normalizer — Phase 2.1.3
 * Idempotent: merge adjacent texts with same marks, remove illegal empties.
 */
import type { PortableDocument, RootNode, BlockNode, TextMarks } from "../model/types.js";

function marksEqual(a: TextMarks | undefined, b: TextMarks | undefined): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

export function normalizeDocument(doc: PortableDocument): PortableDocument {
  const copy: PortableDocument = JSON.parse(JSON.stringify(doc));
  normalizeRoot(copy.root);
  return copy;
}

function normalizeRoot(root: RootNode): void {
  if (!root.children) root.children = [];
  for (const block of root.children) normalizeBlock(block);
}

function normalizeBlock(block: BlockNode): void {
  if (block.type === "paragraph" || block.type === "heading" || block.type === "quote") {
    normalizeInlineChildren(block as unknown as { children: Array<{ type: string; text?: string; marks?: TextMarks; id: string }> });
  } else if (block.type === "list") {
    for (const item of block.items ?? []) {
      normalizeInlineChildren({ children: item.content as unknown as Array<{ type: string; text?: string; marks?: TextMarks; id: string }> } as unknown as { children: Array<{ type: string; text?: string; marks?: TextMarks; id: string }> });
      if (item.nested) normalizeBlock(item.nested);
    }
  } else if (block.type === "table") {
    for (const row of block.rows ?? []) {
      for (const cell of row.cells ?? []) {
        if (!cell.blocks || cell.blocks.length === 0) {
          cell.blocks = [
            {
              type: "paragraph",
              id: `${cell.id}_p`,
              children: [{ type: "text", id: `${cell.id}_t`, text: "" }],
            } as BlockNode,
          ];
        }
        for (const b of cell.blocks) normalizeBlock(b);
      }
    }
  }
}

function normalizeInlineChildren(parent: { children: Array<{ type: string; text?: string; marks?: TextMarks }> }): void {
  if (!Array.isArray(parent.children)) return;
  const out: Array<{ type: string; text?: string; marks?: TextMarks; id: string }> = [];
  for (const child of parent.children as Array<{ type: string; text?: string; marks?: TextMarks; id: string }>) {
    if (child.type === "text") {
      const last = out[out.length - 1] as { type: string; text?: string; marks?: TextMarks } | undefined;
      if (last && last.type === "text" && marksEqual(last.marks, child.marks)) {
        last.text = (last.text ?? "") + (child.text ?? "");
      } else {
        out.push({ ...child });
      }
    } else {
      out.push(child as { type: string; text?: string; marks?: TextMarks; id: string });
    }
  }
  (parent as { children: unknown[] }).children = out;
}

export function isIdempotent(doc: PortableDocument): boolean {
  const a = normalizeDocument(doc);
  const b = normalizeDocument(a);
  return JSON.stringify(a) === JSON.stringify(b);
}
