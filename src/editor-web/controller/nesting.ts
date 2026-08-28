import type { BlockNode, PortableDocument, TableNode, ColumnsNode } from "../../core/model/types.js";
import { createParagraph, createText } from "../../core/model/factories.js";
import { normalizeDocument } from "../../core/normalize/normalize.js";
import type { EditorState } from "./types.js";

export const MAX_LAYOUT_DEPTH = 3;

export function isLayout(n: BlockNode): n is TableNode | ColumnsNode {
  return n.type === "table" || n.type === "columns";
}

export function findParentList(doc: PortableDocument, id: string): { list: BlockNode[]; index: number } | null {
  const search = (list: BlockNode[]): { list: BlockNode[]; index: number } | null => {
    const index = list.findIndex((b) => b.id === id);
    if (index >= 0) return { list, index };
    for (const b of list) {
      if (b.type === "table") {
        for (const row of b.rows) for (const cell of row.cells) {
          const hit = search(cell.blocks);
          if (hit) return hit;
        }
      } else if (b.type === "columns") {
        for (const col of b.columns) {
          const hit = search(col.blocks);
          if (hit) return hit;
        }
      }
    }
    return null;
  };
  return search(doc.root.children);
}

export function findHostBlocks(doc: PortableDocument, hostId: string): BlockNode[] | null {
  const search = (list: BlockNode[]): BlockNode[] | null => {
    for (const b of list) {
      if (b.type === "table") {
        for (const row of b.rows) for (const cell of row.cells) {
          if (cell.id === hostId) return cell.blocks;
          const inner = search(cell.blocks);
          if (inner) return inner;
        }
      } else if (b.type === "columns") {
        for (const col of b.columns) {
          if (col.id === hostId) return col.blocks;
          const inner = search(col.blocks);
          if (inner) return inner;
        }
      }
    }
    return null;
  };
  return search(doc.root.children);
}

export function layoutDepthOf(doc: PortableDocument, id: string): number {
  let depth = 0;
  const walk = (list: BlockNode[], d: number): boolean => {
    for (const b of list) {
      if (b.id === id) { depth = d; return true; }
      if (b.type === "table") {
        for (const row of b.rows) for (const cell of row.cells) {
          if (walk(cell.blocks, d + 1)) return true;
        }
      } else if (b.type === "columns") {
        for (const col of b.columns) {
          if (walk(col.blocks, d + 1)) return true;
        }
      }
    }
    return false;
  };
  walk(doc.root.children, 0);
  return depth;
}

function caretEl(s: EditorState): HTMLElement | null {
  const node = s.selection()?.anchorNode as Node | null;
  const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
  return el && s.container.contains(el) ? el : s.currentBlockEl();
}

export function locateInsert(s: EditorState): { list: BlockNode[]; index: number; depth: number } {
  const doc = s.getDoc();
  let n: HTMLElement | null = caretEl(s);
  while (n && n !== s.container) {
    const id = n.getAttribute("data-node-id");
    if (id) {
      const inList = findParentList(doc, id);
      if (inList) return { ...inList, depth: layoutDepthOf(doc, id) };
      const host = findHostBlocks(doc, id);
      if (host) return { list: host, index: host.length - 1, depth: layoutDepthOf(doc, id) };
    }
    n = n.parentElement;
  }
  const list = doc.root.children;
  return { list, index: Math.max(-1, list.length - 1), depth: 0 };
}

export function commitInsert(s: EditorState, node: BlockNode, loc?: ReturnType<typeof locateInsert>): boolean {
  return commitInsertMany(s, [node], loc);
}

export function commitInsertMany(s: EditorState, nodes: BlockNode[], loc?: ReturnType<typeof locateInsert>): boolean {
  if (!nodes.length) return false;
  const at = loc ?? locateInsert(s);
  if (nodes.some(isLayout) && at.depth >= MAX_LAYOUT_DEPTH) return false;
  s.pushSnapshot();
  at.list.splice(at.index + 1, 0, ...nodes);
  s.setDoc(normalizeDocument(s.getDoc()));
  s.render();
  s.opts.onChange?.(s.getDoc());
  return true;
}

export function insertAfterId(s: EditorState, blockId: string, node: BlockNode): boolean {
  const found = findParentList(s.getDoc(), blockId);
  if (!found) return commitInsert(s, node);
  const depth = layoutDepthOf(s.getDoc(), blockId);
  if (isLayout(node) && depth >= MAX_LAYOUT_DEPTH) return false;
  s.pushSnapshot();
  found.list.splice(found.index + 1, 0, node);
  s.setDoc(normalizeDocument(s.getDoc()));
  s.render();
  s.opts.onChange?.(s.getDoc());
  return true;
}

export function deleteCurrent(s: EditorState): void {
  const loc = locateInsert(s);
  if (loc.index < 0 || !loc.list[loc.index]) return;
  s.pushSnapshot();
  loc.list.splice(loc.index, 1);
  if (!s.getDoc().root.children.length) {
    s.getDoc().root.children.push(createParagraph(s.idGen, [createText(s.idGen, "")]));
  }
  s.setDoc(normalizeDocument(s.getDoc()));
  s.render();
  s.opts.onChange?.(s.getDoc());
}

export function applyWidths(node: ColumnsNode, pcts: number[], idGen: { next: () => string }): void {
  const empty = (): BlockNode => createParagraph(idGen, [createText(idGen, "")]);
  while (node.columns.length < pcts.length) {
    node.columns.push({ id: idGen.next(), widthPct: 0, blocks: [empty()] });
  }
  while (node.columns.length > pcts.length) {
    const extra = node.columns.pop();
    if (extra && node.columns.length) node.columns[node.columns.length - 1]!.blocks.push(...extra.blocks);
  }
  pcts.forEach((p, i) => { node.columns[i]!.widthPct = p; });
}

export function locFromHostEl(s: EditorState, el: HTMLElement | null): ReturnType<typeof locateInsert> | null {
  const host = el?.closest?.("td, th, .pde-column") as HTMLElement | null;
  if (!host || !s.container.contains(host)) return null;
  const id = host.getAttribute("data-node-id") ?? "";
  const list = findHostBlocks(s.getDoc(), id);
  if (!list) return null;
  return { list, index: list.length - 1, depth: layoutDepthOf(s.getDoc(), id) };
}

export function moveBlockToHost(s: EditorState, blockId: string, hostEl: HTMLElement): boolean {
  const dest = locFromHostEl(s, hostEl);
  const src = findParentList(s.getDoc(), blockId);
  if (!dest || !src) return false;
  if (src.list === dest.list) return false;
  s.pushSnapshot();
  const [item] = src.list.splice(src.index, 1);
  if (!item) return false;
  dest.list.push(item);
  s.setDoc(normalizeDocument(s.getDoc()));
  s.render();
  s.opts.onChange?.(s.getDoc());
  return true;
}

export function siblingBlockEl(container: HTMLElement, from: HTMLElement | null): HTMLElement | null {
  if (!from || !container.contains(from) || from === container) return null;
  let cur: HTMLElement = from;
  while (cur.parentElement) {
    const p = cur.parentElement;
    if (p === container || p.classList.contains("pde-column") || p.tagName === "TD" || p.tagName === "TH") return cur;
    cur = p;
  }
  return null;
}
