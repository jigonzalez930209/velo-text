import type { ColumnsNode } from "../../core/model/types.js";
import type { EditorState } from "./types.js";
import { wrapperRel } from "./table-resize.js";

const DRAG_PX = 4;
const MIN_PCT = 8;

export function findColumnsNode(s: EditorState, id: string): ColumnsNode | null {
  let hit: ColumnsNode | null = null;
  const walk = (blocks: ColumnsNode["columns"][number]["blocks"]): void => {
    for (const b of blocks) {
      if (b.type === "columns") {
        if (b.id === id) hit = b;
        for (const c of b.columns) walk(c.blocks);
      }
      if (b.type === "table") for (const row of b.rows) for (const cell of row.cells) walk(cell.blocks);
    }
  };
  walk(s.getDoc().root.children);
  return hit;
}

export function showColumnGutters(s: EditorState, layoutEl: HTMLElement): HTMLElement {
  const layer = s.ownerDoc.createElement("div");
  layer.className = "pde-column-gutters";
  layer.dataset.layoutId = layoutEl.getAttribute("data-node-id") ?? "";
  placeGutters(s, layoutEl, layer);
  s.ui.append(layer);
  return layer;
}

function placeGutters(s: EditorState, layoutEl: HTMLElement, layer: HTMLElement): void {
  const slots = Array.from(layoutEl.querySelectorAll(":scope > .pde-column")) as HTMLElement[];
  const t = wrapperRel(s, layoutEl);
  const layoutId = layoutEl.getAttribute("data-node-id") ?? "";
  for (const old of Array.from(layer.querySelectorAll(".pde-gutter-handle"))) old.remove();
  for (let i = 0; i < slots.length - 1; i++) {
    const r = wrapperRel(s, slots[i]!);
    const h = s.ownerDoc.createElement("span");
    h.className = "pde-gutter-handle";
    h.dataset.gapIndex = String(i);
    h.dataset.layoutId = layoutId;
    h.title = "Drag to resize columns";
    h.tabIndex = 0;
    h.style.left = `${r.left + r.width - 4}px`;
    h.style.top = `${t.top}px`;
    h.style.height = `${t.height}px`;
    layer.appendChild(h);
  }
}

function applyPct(slots: HTMLElement[], node: ColumnsNode): void {
  node.columns.forEach((col, i) => {
    const el = slots[i];
    const pct = col.widthPct ?? 0;
    if (!el) return;
    el.style.flex = `0 0 ${pct}%`;
    el.style.width = `${pct}%`;
    el.style.maxWidth = `${pct}%`;
    el.setAttribute("data-width-pct", String(pct));
  });
}

export function bindColumnResize(s: EditorState): void {
  s.addBoth("pointerdown", ((e: PointerEvent) => {
    const h = (e.target as HTMLElement).closest?.(".pde-gutter-handle") as HTMLElement | null;
    if (!h) return;
    e.preventDefault();
    e.stopPropagation();
    const layoutEl = s.container.querySelector(`.pde-columns[data-node-id="${h.dataset.layoutId}"]`) as HTMLElement | null;
    if (!layoutEl) return;
    const node = findColumnsNode(s, h.dataset.layoutId ?? "");
    if (!node) return;
    const i = Number(h.dataset.gapIndex);
    const left = node.columns[i];
    const right = node.columns[i + 1];
    if (!left || !right) return;
    const slots = Array.from(layoutEl.querySelectorAll(":scope > .pde-column")) as HTMLElement[];
    const startX = e.clientX;
    const startY = e.clientY;
    const total = layoutEl.getBoundingClientRect().width || 1;
    const startL = left.widthPct ?? 50;
    const startR = right.widthPct ?? 50;
    const layer = h.parentElement;
    let armed = false;
    const move = (ev: PointerEvent): void => {
      if (!armed) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_PX) return;
        armed = true;
        s.pushSnapshot();
      }
      const dPct = ((ev.clientX - startX) / total) * 100;
      let nextL = Math.max(MIN_PCT, Math.min(100 - MIN_PCT, startL + dPct));
      let nextR = startL + startR - nextL;
      if (nextR < MIN_PCT) {
        nextR = MIN_PCT;
        nextL = startL + startR - MIN_PCT;
      }
      left.widthPct = Math.round(nextL * 10) / 10;
      right.widthPct = Math.round(nextR * 10) / 10;
      applyPct(slots, node);
      if (layer) placeGutters(s, layoutEl, layer);
    };
    const up = (): void => {
      s.ownerDoc.removeEventListener("pointermove", move);
      s.ownerDoc.removeEventListener("pointerup", up);
      if (armed) s.opts.onChange?.(s.getDoc());
    };
    s.ownerDoc.addEventListener("pointermove", move);
    s.ownerDoc.addEventListener("pointerup", up);
  }) as never);
}
