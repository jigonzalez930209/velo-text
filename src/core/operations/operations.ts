/**
 * Operaciones primitivas — Fase 2.2.1
 * Insertar, borrar, dividir, unir, mover y aplicar marcas. Precondiciones, inversa.
 */
import type { PortableDocument, BlockNode, InlineNode, TextMarks } from "../model/types.js";

export type Operation =
  | { type: "insertBlock"; index: number; block: BlockNode }
  | { type: "deleteBlock"; index: number; block?: BlockNode }
  | { type: "insertInline"; blockId: string; offset: number; node: InlineNode }
  | { type: "deleteInline"; blockId: string; offset: number; removed?: InlineNode[] }
  | { type: "insertInlineBulk"; blockId: string; offset: number; nodes: InlineNode[] }
  | { type: "applyMarks"; blockId: string; index: number; marks: TextMarks };

export interface TransactionResult {
  document: PortableDocument;
  ops: Operation[];
  inverses: Operation[];
  intent: string;
}

interface InternalBlockRef {
  block: BlockNode & { children: InlineNode[] };
  parent: { children: BlockNode[] } | { blocks: BlockNode[] };
}

function findBlock(root: PortableDocument["root"], blockId: string): InternalBlockRef | null {
  for (const b of root.children) {
    if (b.id === blockId) return { block: b as InternalBlockRef["block"], parent: root };
    if (b.type === "table") {
      for (const row of b.rows) for (const cell of row.cells) for (const bl of cell.blocks) if (bl.id === blockId) return { block: bl as InternalBlockRef["block"], parent: cell };
    }
    if (b.type === "list") {
      for (const item of b.items) {
        if (item.nested && item.nested.id === blockId) return { block: item.nested as unknown as InternalBlockRef["block"], parent: item as unknown as { children: BlockNode[] } };
      }
    }
  }
  return null;
}

export function createTransaction(doc: PortableDocument, intent = "generic") {
  let working: PortableDocument = JSON.parse(JSON.stringify(doc));
  const ops: Operation[] = [];
  const inverses: Operation[] = [];

  function push(op: Operation, inverse: Operation): void {
    ops.push(op);
    inverses.unshift(inverse);
  }

  return {
    get doc(): PortableDocument {
      return working;
    },
    get ops(): readonly Operation[] {
      return ops;
    },
    insertBlock(index: number, block: BlockNode): void {
      const before = working.root.children.length;
      if (index < 0 || index > before) throw new Error(`insertBlock out of bounds ${index}/${before}`);
      working.root.children.splice(index, 0, block);
      push({ type: "insertBlock", index, block }, { type: "deleteBlock", index });
    },
    deleteBlock(index: number): void {
      const block = working.root.children[index];
      if (!block) throw new Error(`deleteBlock ${index} not found`);
      working.root.children.splice(index, 1);
      push({ type: "deleteBlock", index, block }, { type: "insertBlock", index, block });
    },
    insertInline(blockId: string, offset: number, inlineNode: InlineNode): void {
      const loc = findBlock(working.root, blockId);
      if (!loc) throw new Error(`block ${blockId} not found`);
      const children = loc.block.children as InlineNode[];
      if (offset < 0 || offset > children.length) throw new Error(`insertInline offset ${offset} out of bounds`);
      children.splice(offset, 0, inlineNode);
      push({ type: "insertInline", blockId, offset, node: inlineNode }, { type: "deleteInline", blockId, offset });
    },
    deleteInline(blockId: string, offset: number, count = 1): void {
      const loc = findBlock(working.root, blockId);
      if (!loc) throw new Error(`block ${blockId} not found`);
      const children = loc.block.children as InlineNode[];
      const removed = children.splice(offset, count);
      push({ type: "deleteInline", blockId, offset, removed }, { type: "insertInlineBulk", blockId, offset, nodes: removed });
    },
    applyMarks(blockId: string, start: number, end: number, marks: TextMarks): void {
      const loc = findBlock(working.root, blockId);
      if (!loc) throw new Error(`block ${blockId} not found`);
      const children = loc.block.children as InlineNode[];
      for (let i = start; i < Math.min(end, children.length); i++) {
        const node = children[i];
        if (node.type === "text") {
          const prev: TextMarks = { ...(node.marks ?? {}) };
          node.marks = { ...(node.marks ?? {}), ...marks };
          push({ type: "applyMarks", blockId, index: i, marks }, { type: "applyMarks", blockId, index: i, marks: prev });
        }
      }
    },
    commit(): TransactionResult {
      working.updatedAt = new Date().toISOString();
      working.revision = (working.revision ?? 0) + 1;
      return { document: working, ops: [...ops], inverses: [...inverses], intent };
    },
    rollback(): void {
      working = JSON.parse(JSON.stringify(doc));
    },
  };
}

export type Transaction = ReturnType<typeof createTransaction>;
