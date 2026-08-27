import { umToPx } from "../../export/layout/units.js";
import type { EditorState } from "./types.js";

export function wrapperRel(s: EditorState, el: Element): { left: number; top: number; width: number; height: number } {
  const w = s.wrapper.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { left: r.left - w.left, top: r.top - w.top, width: r.width, height: r.height };
}

export function findTableNode(s: EditorState, table: HTMLElement) {
  const id = table.getAttribute("data-node-id");
  const found = s.getDoc().root.children.find((b) => b.id === id);
  return found?.type === "table" ? found : null;
}

export function bindTableResize(s: EditorState): void {
  s.addBoth("pointerdown", ((e: PointerEvent) => {
    const h = (e.target as HTMLElement).closest?.("[data-col-index], [data-row-index]") as HTMLElement | null;
    if (!h) return;
    e.preventDefault();
    e.stopPropagation();
    const tableId = h.dataset.tableId;
    const table = s.container.querySelector(`table[data-node-id="${tableId}"]`) as HTMLTableElement | null;
    if (!table) return;
    const tblNode = findTableNode(s, table);
    if (!tblNode) return;
    const start = e.clientX;
    const startY = e.clientY;
    s.pushSnapshot();
    if (h.dataset.colIndex != null) {
      const colIdx = Number(h.dataset.colIndex);
      const col = tblNode.columns[colIdx];
      if (!col) return;
      const startW = col.widthUm;
      const onMove = (ev: PointerEvent): void => {
        col.widthUm = Math.max(12000, startW + Math.round((ev.clientX - start) * (25400 / 96)));
        const colEl = table.querySelectorAll("colgroup col")[colIdx] as HTMLElement | null;
        if (colEl) {
          colEl.style.width = `${Math.round(umToPx(col.widthUm))}px`;
          colEl.setAttribute("data-col-width-um", String(col.widthUm));
        }
      };
      finishDrag(s, onMove);
      return;
    }
    const rowIdx = Number(h.dataset.rowIndex);
    const row = tblNode.rows[rowIdx];
    if (!row) return;
    const tr = table.querySelectorAll("tbody tr")[rowIdx] as HTMLElement | null;
    const startH = row.heightUm ?? Math.round((tr?.getBoundingClientRect().height ?? 32) * (25400 / 96));
    const onMove = (ev: PointerEvent): void => {
      row.heightUm = Math.max(8000, startH + Math.round((ev.clientY - startY) * (25400 / 96)));
      if (tr) {
        tr.style.height = `${Math.round(umToPx(row.heightUm))}px`;
        tr.setAttribute("data-height-um", String(row.heightUm));
      }
    };
    finishDrag(s, onMove);
  }) as never);
}

function finishDrag(s: EditorState, onMove: (ev: PointerEvent) => void): void {
  const onUp = (): void => {
    s.ownerDoc.removeEventListener("pointermove", onMove);
    s.ownerDoc.removeEventListener("pointerup", onUp);
    s.opts.onChange?.(s.getDoc());
  };
  s.ownerDoc.addEventListener("pointermove", onMove);
  s.ownerDoc.addEventListener("pointerup", onUp);
}

export function showTableResize(s: EditorState, table: HTMLTableElement): HTMLElement {
  const layer = s.ownerDoc.createElement("div");
  layer.className = "pde-table-resize";
  layer.dataset.tableId = table.getAttribute("data-node-id") ?? "";
  const t = wrapperRel(s, table);
  const cols = table.querySelectorAll("colgroup col");
  let x = 0;
  for (let i = 0; i < cols.length; i++) {
    x += (cols[i] as HTMLElement).getBoundingClientRect().width || (cols[i] as HTMLElement).offsetWidth;
    const h = s.ownerDoc.createElement("span");
    h.className = "pde-col-handle";
    h.dataset.colIndex = String(i);
    h.dataset.tableId = layer.dataset.tableId;
    h.title = "Drag to resize column";
    h.style.left = `${t.left + x - 3}px`;
    h.style.top = `${t.top - 2}px`;
    h.style.height = `${t.height + 4}px`;
    layer.appendChild(h);
  }
  const rows = table.querySelectorAll("tbody tr");
  for (let i = 0; i < rows.length; i++) {
    const rr = wrapperRel(s, rows[i] as HTMLElement);
    const h = s.ownerDoc.createElement("span");
    h.className = "pde-row-handle";
    h.dataset.rowIndex = String(i);
    h.dataset.tableId = layer.dataset.tableId;
    h.title = "Drag to resize row";
    h.style.left = `${rr.left}px`;
    h.style.width = `${rr.width}px`;
    h.style.top = `${rr.top + rr.height - 3}px`;
    layer.appendChild(h);
  }
  s.ui.append(layer);
  return layer;
}
