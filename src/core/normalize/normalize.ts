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
  canonicalizeInlineIds(copy.root);
  return copy;
}

/**
 * Assign deterministic inline IDs derived from their parent block so that
 * factory-created documents and DOM-parsed documents converge to the same
 * canonical form. This keeps history snapshots stable (undo/redo idempotence).
 *  - text node in block B: `B_t<index>`
 *  - hard break in block B: `B_br<index>`
 *  - atomic nodes (variable/equation/inline-image) keep their stable IDs
 *  - link children derive from the link ID
 */
function canonicalizeInlineIds(root: RootNode): void {
  const walkBlocks = (blocks: BlockNode[]): void => {
    for (const b of blocks) {
      if (b.type === "paragraph" || b.type === "heading" || b.type === "quote") {
        canonicalizeInlineArray(b.children, b.id);
      } else if (b.type === "list") {
        for (const item of b.items ?? []) {
          canonicalizeInlineArray(item.content, item.id);
          if (item.nested) walkBlocks([item.nested]);
        }
      } else if (b.type === "table") {
        for (let ci2 = 0; ci2 < b.columns.length; ci2++) {
          b.columns[ci2]!.id = `${b.id}_c${ci2}`;
        }
        for (let ri = 0; ri < b.rows.length; ri++) {
          const row = b.rows[ri]!;
          row.id = `${b.id}_r${ri}`;
          let ci = 0;
          for (const cell of row.cells) {
            cell.id = `${b.id}_r${ri}c${ci}`;
            ci += cell.colSpan ?? 1;
            walkBlocks(cell.blocks);
          }
        }
      } else if (b.type === "columns") {
        for (const col of b.columns) walkBlocks(col.blocks);
      }
    }
  };
  walkBlocks(root.children);
}

function canonicalizeInlineArray(inlines: Array<InlineNodeLike>, baseId: string): void {
  let t = 0;
  let br = 0;
  for (const n of inlines) {
    if (n.type === "text") {
      n.id = `${baseId}_t${t++}`;
    } else if (n.type === "hard-break") {
      n.id = `${baseId}_br${br++}`;
    } else if (n.type === "link" && n.children) {
      let lt = 0;
      for (const c of n.children) {
        if (c.type === "text") c.id = `${n.id}_t${lt++}`;
        else if (c.type === "hard-break") c.id = `${n.id}_br${br++}`;
      }
    }
  }
}

interface InlineNodeLike {
  type: string;
  id: string;
  children?: InlineNodeLike[];
}

function normalizeRoot(root: RootNode): void {
  if (!root.children) root.children = [];
  const collapsed: BlockNode[] = [];
  for (const block of root.children) {
    if (block.type === "section-break") {
      const last = collapsed[collapsed.length - 1];
      if (last && last.type === "section-break") {
        collapsed[collapsed.length - 1] = {
          ...block,
          settings: {
            ...(last.settings ?? {}),
            ...(block.settings ?? {}),
          },
        };
        continue;
      }
    }
    collapsed.push(block);
  }
  root.children = collapsed;
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
  } else if (block.type === "columns") {
    for (const col of block.columns ?? []) {
      if (!col.blocks || col.blocks.length === 0) {
        col.blocks = [{ type: "paragraph", id: `${col.id}_p`, children: [{ type: "text", id: `${col.id}_t`, text: "" }] } as BlockNode];
      }
      for (const b of col.blocks) normalizeBlock(b);
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
