/**
 * Selección — Fase 2.2.2
 * RangeSelection con anchor/focus Point(nodeId, offset, affinity)
 */
import type { Point, RangeSelection, Selection } from "../model/types.js";
import type { Operation } from "../operations/operations.js";

export function createCollapsedSelection(nodeId: string, offset: number, affinity: Point["affinity"] = "forward"): RangeSelection {
  const pt: Point = { nodeId, offset, affinity };
  return { kind: "range", anchor: pt, focus: { ...pt } };
}

export function createRangeSelection(anchor: Point, focus: Point): RangeSelection {
  return { kind: "range", anchor, focus };
}

export function isCollapsed(sel: Selection): boolean {
  if (sel.kind !== "range") return false;
  return sel.anchor.nodeId === sel.focus.nodeId && sel.anchor.offset === sel.focus.offset;
}

export function isRangeSelection(sel: Selection): sel is RangeSelection {
  return sel.kind === "range";
}

// Mapear selección a través de operaciones primitivas (simplificado para MVP)
export function mapSelectionThroughOps(selection: RangeSelection, ops: readonly Operation[]): RangeSelection {
  let anchor: Point = { ...selection.anchor };
  let focus: Point = { ...selection.focus };
  for (const op of ops) {
    if (op.type === "insertInline" && op.blockId === anchor.nodeId && op.offset <= anchor.offset) {
      anchor = { ...anchor, offset: anchor.offset + 1 };
    }
    if (op.type === "insertInline" && op.blockId === focus.nodeId && op.offset <= focus.offset) {
      focus = { ...focus, offset: focus.offset + 1 };
    }
    if (op.type === "deleteInline" && op.blockId === anchor.nodeId && op.offset < anchor.offset) {
      const removed = op.removed?.length ?? 1;
      anchor = { ...anchor, offset: Math.max(op.offset, anchor.offset - removed) };
    }
    if (op.type === "deleteInline" && op.blockId === focus.nodeId && op.offset < focus.offset) {
      const removed = op.removed?.length ?? 1;
      focus = { ...focus, offset: Math.max(op.offset, focus.offset - removed) };
    }
  }
  return { kind: "range", anchor, focus };
}
