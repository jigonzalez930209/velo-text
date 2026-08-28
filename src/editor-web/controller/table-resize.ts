import { umToPx } from "../../export/layout/units.js";
import type { TableNode } from "../../core/model/types.js";
import { findParentList } from "./nesting.js";
import type { EditorState } from "./types.js";

const PX_UM = 25400 / 96;
const MIN_COL_UM = 12_000;
const DRAG_PX = 4;

export function wrapperRel(s: EditorState, el: Element): { left: number; top: number; width: number; height: number } {
  const w = s.wrapper.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { left: r.left - w.left, top: r.top - w.top, width: r.width, height: r.height };
}

export function findTableNode(s: EditorState, table: HTMLElement): TableNode | null {
  const id = table.getAttribute("data-node-id") ?? "";
  const found = findParentList(s.getDoc(), id);
  const n = found?.list[found.index];
  return n?.type === "table" ? n : null;
}

function firstRowCells(table: HTMLTableElement): HTMLElement[] {
  const row = table.querySelector("tr");
  return row ? (Array.from(row.children) as HTMLElement[]) : [];
}

function placeColHandles(s: EditorState, table: HTMLTableElement, layer: HTMLElement): void {
  const t = wrapperRel(s, table);
  const cells = firstRowCells(table);
  const tableId = table.getAttribute("data-node-id") ?? "";
  for (const old of Array.from(layer.querySelectorAll(".pde-col-handle"))) old.remove();
  for (let i = 0; i < cells.length - 1; i++) {
    const r = wrapperRel(s, cells[i]!);
    const h = s.ownerDoc.createElement("span");
    h.className = "pde-col-handle";
    h.dataset.colIndex = String(i);
    h.dataset.tableId = tableId;
    h.title = "Drag to resize column";
    h.tabIndex = 0;
    h.style.left = `${r.left + r.width - 4}px`;
    h.style.top = `${t.top - 2}px`;
    h.style.height = `${t.height + 4}px`;
    layer.appendChild(h);
  }
}

function applyColPair(table: HTMLTableElement, node: TableNode, i: number): void {
  const cols = table.querySelectorAll("colgroup col");
  for (const idx of [i, i + 1]) {
    const col = node.columns[idx];
    const el = cols[idx] as HTMLElement | undefined;
    if (!col || !el) continue;
    el.style.width = `${Math.round(umToPx(col.widthUm))}px`;
    el.setAttribute("data-col-width-um", String(col.widthUm));
  }
}

export function bindTableResize(s: EditorState): void {
  s.addBoth("pointerdown", ((e: PointerEvent) => {
    const h = (e.target as HTMLElement).closest?.(".pde-col-handle, .pde-row-handle") as HTMLElement | null;
    if (!h) return;
    e.preventDefault();
    e.stopPropagation();
    const table = s.container.querySelector(`table[data-node-id="${h.dataset.tableId}"]`) as HTMLTableElement | null;
    if (!table) return;
    const tblNode = findTableNode(s, table);
    if (!tblNode) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const layer = h.parentElement;
    if (h.dataset.colIndex != null) {
      const colIdx = Number(h.dataset.colIndex);
      const left = tblNode.columns[colIdx];
      const right = tblNode.columns[colIdx + 1];
      if (!left || !right) return;
      const cells = firstRowCells(table);
      const lw = cells[colIdx]?.getBoundingClientRect().width ?? 0;
      const rw = cells[colIdx + 1]?.getBoundingClientRect().width ?? 0;
      const startL = lw > 1 ? Math.round(lw * PX_UM) : left.widthUm;
      const startR = rw > 1 ? Math.round(rw * PX_UM) : right.widthUm;
      finishDrag(s, startX, startY, (ev) => {
        const d = Math.round((ev.clientX - startX) * PX_UM);
        const nextL = Math.max(MIN_COL_UM, startL + d);
        const nextR = Math.max(MIN_COL_UM, startR - d);
        const used = nextL - startL;
        left.widthUm = nextL;
        right.widthUm = startR - used;
        if (right.widthUm < MIN_COL_UM) {
          right.widthUm = MIN_COL_UM;
          left.widthUm = startL + startR - MIN_COL_UM;
        }
        applyColPair(table, tblNode, colIdx);
        if (layer) placeColHandles(s, table, layer);
      });
      return;
    }
    const rowIdx = Number(h.dataset.rowIndex);
    const row = tblNode.rows[rowIdx];
    const tr = table.querySelectorAll("tbody tr")[rowIdx] as HTMLElement | null;
    if (!row) return;
    const measured = tr?.getBoundingClientRect().height ?? 0;
    const startH = measured > 1 ? Math.round(measured * PX_UM) : (row.heightUm ?? Math.round(32 * PX_UM));
    finishDrag(s, startX, startY, (ev) => {
      row.heightUm = Math.max(8000, startH + Math.round((ev.clientY - startY) * PX_UM));
      if (tr) {
        tr.style.height = `${Math.round(umToPx(row.heightUm))}px`;
        tr.setAttribute("data-height-um", String(row.heightUm));
      }
    });
  }) as never);
}

function finishDrag(s: EditorState, startX: number, startY: number, onMove: (ev: PointerEvent) => void): void {
  let armed = false;
  const move = (ev: PointerEvent): void => {
    if (!armed) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_PX) return;
      armed = true;
      s.pushSnapshot();
    }
    onMove(ev);
  };
  const onUp = (): void => {
    s.ownerDoc.removeEventListener("pointermove", move);
    s.ownerDoc.removeEventListener("pointerup", onUp);
    if (armed) s.opts.onChange?.(s.getDoc());
  };
  s.ownerDoc.addEventListener("pointermove", move);
  s.ownerDoc.addEventListener("pointerup", onUp);
}

export function showTableResize(s: EditorState, table: HTMLTableElement): HTMLElement {
  const layer = s.ownerDoc.createElement("div");
  layer.className = "pde-table-resize";
  layer.dataset.tableId = table.getAttribute("data-node-id") ?? "";
  placeColHandles(s, table, layer);
  const rows = table.querySelectorAll("tbody tr");
  for (let i = 0; i < rows.length; i++) {
    const rr = wrapperRel(s, rows[i] as HTMLElement);
    const h = s.ownerDoc.createElement("span");
    h.className = "pde-row-handle";
    h.dataset.rowIndex = String(i);
    h.dataset.tableId = layer.dataset.tableId;
    h.title = "Drag to resize row";
    h.tabIndex = 0;
    h.style.left = `${rr.left}px`;
    h.style.width = `${rr.width}px`;
    h.style.top = `${rr.top + rr.height - 3}px`;
    layer.appendChild(h);
  }
  s.ui.append(layer);
  return layer;
}
