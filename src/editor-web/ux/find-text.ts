import type { BlockNode, InlineNode, PortableDocument, TextNode } from "../../core/model/types.js";

export interface TextHit {
  nodeId: string;
  blockId: string;
  start: number;
  end: number;
}

function visitInlines(inlines: InlineNode[], blockId: string, hits: TextHit[], q: string): void {
  const needle = q.toLowerCase();
  if (!needle) return;
  for (const n of inlines) {
    if (n.type === "text") {
      const hay = n.text.toLowerCase();
      let from = 0;
      while (from < hay.length) {
        const i = hay.indexOf(needle, from);
        if (i < 0) break;
        hits.push({ nodeId: n.id, blockId, start: i, end: i + needle.length });
        from = i + needle.length;
      }
    } else if (n.type === "link") visitInlines(n.children as InlineNode[], blockId, hits, q);
  }
}

function visitBlocks(blocks: BlockNode[], hits: TextHit[], q: string): void {
  for (const b of blocks) {
    if (b.type === "paragraph" || b.type === "heading" || b.type === "quote") visitInlines(b.children, b.id, hits, q);
    else if (b.type === "list") {
      for (const item of b.items) {
        visitInlines(item.content, b.id, hits, q);
        if (item.nested) visitBlocks([item.nested], hits, q);
      }
    } else if (b.type === "table") {
      for (const row of b.rows) for (const cell of row.cells) visitBlocks(cell.blocks, hits, q);
    } else if (b.type === "columns") {
      for (const col of b.columns) visitBlocks(col.blocks, hits, q);
    }
  }
}

export function findTextHits(doc: PortableDocument, query: string): TextHit[] {
  const hits: TextHit[] = [];
  visitBlocks(doc.root.children, hits, query);
  return hits;
}

function replaceInNode(n: TextNode, q: string, repl: string, limit: number): number {
  if (limit <= 0 || !q) return 0;
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  let left = limit;
  n.text = n.text.replace(re, (m) => {
    if (left <= 0) return m;
    left--;
    return repl;
  });
  return limit - left;
}

function walkReplace(blocks: BlockNode[], q: string, repl: string, limit: number): number {
  let left = limit;
  const inlines = (nodes: InlineNode[]): void => {
    for (const n of nodes) {
      if (left <= 0) return;
      if (n.type === "text") left -= replaceInNode(n, q, repl, left);
      else if (n.type === "link") inlines(n.children as InlineNode[]);
    }
  };
  for (const b of blocks) {
    if (left <= 0) break;
    if (b.type === "paragraph" || b.type === "heading" || b.type === "quote") inlines(b.children);
    else if (b.type === "list") {
      for (const item of b.items) {
        inlines(item.content);
        if (item.nested) left = walkReplace([item.nested], q, repl, left);
      }
    } else if (b.type === "table") {
      for (const row of b.rows) for (const cell of row.cells) left = walkReplace(cell.blocks, q, repl, left);
    } else if (b.type === "columns") {
      for (const col of b.columns) left = walkReplace(col.blocks, q, repl, left);
    }
  }
  return left;
}

export function replaceTextInDocument(doc: PortableDocument, query: string, replacement: string, limit = Infinity): number {
  const before = Number.isFinite(limit) ? limit : 1_000_000;
  return before - walkReplace(doc.root.children, query, replacement, before);
}
