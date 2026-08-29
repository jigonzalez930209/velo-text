import { normalizeDocument } from "../../core/normalize/normalize.js";
import { createColumns } from "../../core/model/factories.js";
import type { ColumnsNode } from "../../core/model/types.js";
import type { EditorState, InsertBlockType } from "./types.js";
import { COLUMN_PRESETS } from "./column-presets.js";
import { applyWidths, commitInsert, MAX_LAYOUT_DEPTH, layoutDepthOf, findParentList } from "./nesting.js";
import { makeBlock } from "./commands.js";
import { wrapperRel, clampToWrapper } from "./table-resize.js";
import { bindColumnResize, findColumnsNode, showColumnGutters } from "./column-resize.js";
import { barAlignPad, barFlyBtn, barIconBtn, barMenuItem } from "./bar-chrome.js";

const BAR_H = 36;
const GAP = 3;

export function attachColumnsUi(s: EditorState): { hideColumnsUi: () => void } {
  let flyEl: HTMLElement | null = null;
  let barEl: HTMLElement | null = null;
  let gutterEl: HTMLElement | null = null;
  let live: HTMLElement | null = null;
  let slotIndex = 0;
  let sel: number[] = [];
  let dragFrom: number | null = null;
  let didDrag = false;
  const wipe = (): void => {
    flyEl?.remove(); barEl?.remove(); gutterEl?.remove();
    flyEl = barEl = gutterEl = null;
  };
  function hideFly(): void { flyEl?.remove(); flyEl = null; }
  function hideBar(): void { barEl?.remove(); barEl = null; }
  function hideColumnsUi(): void {
    wipe();
    if (live) paintSlots(live, [], -1);
    live = null; sel = [];
  }
  function toolbarFloor(): number {
    const tb = s.ownerDoc.querySelector(".pde-toolbar") as HTMLElement | null;
    return tb ? Math.max(4, tb.getBoundingClientRect().bottom - s.wrapper.getBoundingClientRect().top + 4) : 4;
  }

  function layoutOp(mutate: () => void): void {
    const id = live?.getAttribute("data-node-id");
    s.pushSnapshot();
    mutate();
    s.setDoc(normalizeDocument(s.getDoc()));
    s.render();
    s.opts.onChange?.(s.getDoc());
    if (id) {
      const el = s.container.querySelector(`.pde-columns[data-node-id="${id}"]`) as HTMLElement | null;
      if (el) showChrome(el);
    }
  }

  function node(): ColumnsNode | null {
    return live ? findColumnsNode(s, live.getAttribute("data-node-id") ?? "") : null;
  }

  function slots(): ColumnsNode["columns"][0][] {
    const n = node();
    if (!n) return [];
    const idx = sel.length ? sel : [slotIndex];
    return idx.map((i) => n.columns[i]).filter(Boolean) as ColumnsNode["columns"][0][];
  }

  function paintSlots(layout: HTMLElement, selected: number[], active: number): void {
    for (const el of Array.from(layout.querySelectorAll(":scope > .pde-column"))) {
      el.classList.remove("pde-cell-sel", "pde-cell-active");
    }
    const cols = Array.from(layout.querySelectorAll(":scope > .pde-column"));
    for (const i of selected) cols[i]?.classList.add("pde-cell-sel");
    if (active >= 0) cols[active]?.classList.add("pde-cell-active");
  }

  function showChrome(layoutEl: HTMLElement): void {
    wipe();
    live = layoutEl;
    gutterEl = showColumnGutters(s, layoutEl);
    barEl = s.ownerDoc.createElement("div");
    barEl.className = "pde-table-bar pde-columns-bar";
    barEl.setAttribute("role", "toolbar");
    barEl.setAttribute("aria-label", "Layout editing");
    fillBar();
    parkBar(layoutEl);
    paintSlots(layoutEl, sel.length ? sel : [slotIndex], slotIndex);
  }

  function parkBar(host: HTMLElement): void {
    if (!barEl) return;
    const t = wrapperRel(s, host);
    barEl.style.left = `${Math.max(4, t.left)}px`;
    s.ui.append(barEl);
    const h = barEl.offsetHeight || BAR_H;
    barEl.style.top = `${Math.max(toolbarFloor(), t.top - h - GAP)}px`;
    clampToWrapper(s, barEl);
  }

  function slotHV(): { h: string; v: string } {
    const slot = node()?.columns[slotIndex];
    const ha = (slot?.blocks[0] as { align?: string } | undefined)?.align;
    const h = ha === "center" || ha === "right" || ha === "justify" ? ha : "left";
    const v = slot?.vAlign === "middle" || slot?.vAlign === "bottom" ? slot.vAlign : "top";
    return { h, v };
  }

  function placeFly(b: HTMLButtonElement): void {
    if (!flyEl || !barEl) return;
    const br = barEl.getBoundingClientRect();
    const wr = s.wrapper.getBoundingClientRect();
    flyEl.style.left = `${Math.max(4, b.getBoundingClientRect().left - wr.left)}px`;
    flyEl.style.top = `${Math.max(toolbarFloor(), br.bottom - wr.top + 4)}px`;
    s.ui.append(flyEl);
    clampToWrapper(s, flyEl);
  }

  function openFly(btn: HTMLButtonElement, fill: (el: HTMLElement) => void): void {
    hideFly();
    flyEl = s.ownerDoc.createElement("div");
    flyEl.className = "pde-block-menu pde-columns-menu";
    fill(flyEl);
    placeFly(btn);
  }

  function fillBar(): void {
    if (!barEl) return;
    barEl.replaceChildren();
    const hint = s.ownerDoc.createElement("span");
    hint.className = "pde-table-bar-cell";
    hint.textContent = `C${slotIndex + 1}`;
    hint.title = "Active column";
    barEl.append(hint);
    barEl.append(barIconBtn(s.ownerDoc, "insertRowAbove", "Insert row above", () => layoutOp(() => {
      const n = node();
      const found = findParentList(s.getDoc(), live?.getAttribute("data-node-id") ?? "");
      if (n && found) found.list.splice(found.index, 0, createColumns(s.idGen, n.columns.map((c) => c.widthPct ?? 50)));
    })));
    barEl.append(barIconBtn(s.ownerDoc, "insertRowBelow", "Insert row below", () => layoutOp(() => {
      const n = node();
      const found = findParentList(s.getDoc(), live?.getAttribute("data-node-id") ?? "");
      if (n && found) found.list.splice(found.index + 1, 0, createColumns(s.idGen, n.columns.map((c) => c.widthPct ?? 50)));
    })));
    const hv = slotHV();
    barEl.append(barFlyBtn(s.ownerDoc, "alignCenter", "Cell alignment", (btn) => openFly(btn, (host) => {
      host.append(barAlignPad(s.ownerDoc, hv.h, hv.v, (a) => layoutOp(() => {
        for (const slot of slots()) {
          for (const bl of slot.blocks) {
            if (bl.type === "paragraph" || bl.type === "heading" || bl.type === "quote") (bl as { align?: string }).align = a;
          }
        }
      }), (a) => layoutOp(() => { for (const slot of slots()) slot.vAlign = a; })));
    })));
    barEl.append(barFlyBtn(s.ownerDoc, "columns3", "Column widths", (btn) => openFly(btn, (host) => {
      for (const preset of COLUMN_PRESETS) {
        const b = s.ownerDoc.createElement("button");
        b.type = "button";
        b.innerHTML = `<span class="pde-preset-bars">${preset.pcts.map((p) => `<i style="flex:${p}"></i>`).join("")}</span><span>${preset.label}</span>`;
        b.onclick = () => {
          hideFly();
          const n = node();
          if (n) layoutOp(() => applyWidths(n, preset.pcts, s.idGen));
        };
        host.appendChild(b);
      }
    })));
    barEl.append(barFlyBtn(s.ownerDoc, "plus", "Insert in focused slot", (btn) => openFly(btn, (host) => {
      const n = node();
      const depth = n ? layoutDepthOf(s.getDoc(), n.id) : 0;
      const kinds: InsertBlockType[] = ["paragraph", "table", "columns"];
      for (const type of kinds) {
        if ((type === "table" || type === "columns") && depth >= MAX_LAYOUT_DEPTH) continue;
        const label = type === "paragraph" ? "Paragraph" : type === "table" ? "Table" : "Nested columns";
        host.append(barMenuItem(s.ownerDoc, label, () => { commitInsert(s, makeBlock(s, type)); hideBar(); }));
      }
    })));
    barEl.append(barIconBtn(s.ownerDoc, "trash", "Delete layout", () => layoutOp(() => {
      const found = findParentList(s.getDoc(), live?.getAttribute("data-node-id") ?? "");
      if (found) found.list.splice(found.index, 1);
    }), true));
  }

  function slotOf(el: HTMLElement | null, host: HTMLElement | null = live): number {
    const col = el?.closest?.(".pde-column") as HTMLElement | null;
    if (!col || !host?.contains(col)) return -1;
    return Number(col.getAttribute("data-col-index") ?? "-1");
  }

  s.addBoth("click", ((e: MouseEvent) => {
    const el = e.target as HTMLElement | null;
    if (el?.closest?.(".pde-gutter-handle, .pde-columns-bar, .pde-columns-menu, .pde-table-bar")) return;
    if (el?.closest?.("table.pde-table")) { hideColumnsUi(); return; }
    const layout = el?.closest?.(".pde-columns") as HTMLElement | null;
    if (!layout || !s.container.contains(layout)) { hideColumnsUi(); return; }
    const i = slotOf(el, layout);
    if (i >= 0 && !didDrag) { slotIndex = i; sel = [i]; }
    didDrag = false;
    showChrome(layout);
  }) as never);

  s.addBoth("pointerdown", ((e: PointerEvent) => {
    const layout = (e.target as HTMLElement)?.closest?.(".pde-columns") as HTMLElement | null;
    if (!layout || !s.container.contains(layout)) return;
    live = layout;
    const i = slotOf(e.target as HTMLElement, layout);
    dragFrom = i >= 0 ? i : null;
    didDrag = false;
  }) as never);

  const onMove = (e: PointerEvent): void => {
    if (dragFrom == null || !live) return;
    const layout = (e.target as HTMLElement)?.closest?.(".pde-columns");
    if (layout !== live) return;
    const to = slotOf(e.target as HTMLElement);
    if (to < 0 || to === dragFrom) return;
    didDrag = true;
    const a = Math.min(dragFrom, to);
    const b = Math.max(dragFrom, to);
    sel = [];
    for (let i = a; i <= b; i++) sel.push(i);
    slotIndex = to;
    paintSlots(live, sel, slotIndex);
    const hint = barEl?.querySelector(".pde-table-bar-cell");
    if (hint) hint.textContent = `C${slotIndex + 1}`;
  };
  const onUp = (): void => { dragFrom = null; };
  s.ownerDoc.addEventListener("pointermove", onMove);
  s.ownerDoc.addEventListener("pointerup", onUp);
  s.cleanup.push(() => { s.ownerDoc.removeEventListener("pointermove", onMove); s.ownerDoc.removeEventListener("pointerup", onUp); });
  bindColumnResize(s);
  return { hideColumnsUi };
}
