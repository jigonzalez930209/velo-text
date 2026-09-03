import { normalizeDocument } from "../../core/normalize/normalize.js";
import type { TableNode } from "../../core/model/types.js";
import { applyDensity, applyPreset, cellFill, cellVAlign, clearCellStyle, clearTableStyle, resolvedLook, shadeCell, toggleLook, setCellVAlign } from "../../core/model/table-look.js";
import type { EditorState } from "./types.js";
import { bindTableResize, findTableNode, showTableResize, wrapperRel, clampToWrapper } from "./table-resize.js";
import { findParentList } from "./nesting.js";
import { insertBlankRow, deleteCols, deleteRows, forPickedCells, insertCol, mergeRight, setCellTextAlign } from "./table-ops.js";
import { cellPick, expandDrag, paintCellClasses, type TablePick } from "./table-select.js";
import { barAlignPad, barCellSwatch, barFlyBtn, barIconBtn, barMenuItem, barTableStylePad, closeCellFillPalette } from "./bar-chrome.js";
import { parkContextBar } from "./chrome-bar.js";
import { placeOverlay } from "./place-overlay.js";

const BAR_H = 36;
const GAP = 3;

export function attachTableUi(s: EditorState): { hideTableUi: () => void } {
  let flyEl: HTMLElement | null = null;
  let resizeEl: HTMLElement | null = null;
  let barEl: HTMLElement | null = null;
  let liveTable: HTMLTableElement | null = null;
  let active: TablePick | null = null;
  let sel: TablePick[] = [];
  let dragFrom: TablePick | null = null;
  let didDrag = false;
  const wipe = (): void => {
    flyEl?.remove(); resizeEl?.remove(); barEl?.remove();
    flyEl = resizeEl = barEl = null;
  };
  function hideFly(): void { flyEl?.remove(); flyEl = null; closeCellFillPalette(); }
  function hideTableUi(): void {
    wipe();
    closeCellFillPalette();
    if (liveTable) paintCellClasses(liveTable, [], null);
    liveTable = null; active = null; sel = [];
  }

  function tableOp(mutate: () => void): void {
    const id = liveTable?.getAttribute("data-node-id");
    s.pushSnapshot();
    mutate();
    s.setDoc(normalizeDocument(s.getDoc()));
    s.render();
    s.opts.onChange?.(s.getDoc());
    if (id) {
      const t = s.container.querySelector(`table[data-node-id="${id}"]`) as HTMLTableElement | null;
      if (t) showChrome(t);
    }
  }

  function toolbarFloor(): number {
    const tb = s.ownerDoc.querySelector(".pde-toolbar") as HTMLElement | null;
    if (!tb) return 4;
    return Math.max(4, tb.getBoundingClientRect().bottom - s.wrapper.getBoundingClientRect().top + 4);
  }

  function showChrome(table: HTMLTableElement): void {
    wipe();
    liveTable = table;
    resizeEl = showTableResize(s, table);
    barEl = s.ownerDoc.createElement("div");
    barEl.className = "pde-table-bar";
    barEl.setAttribute("role", "toolbar");
    barEl.setAttribute("aria-label", "Table editing");
    fillBar(table);
    parkBar(table);
    paintCellClasses(table, sel, active);
  }

  function parkBar(host: HTMLElement): void {
    if (!barEl) return;
    if (parkContextBar(s, barEl)) return;
    const cell = (active
      ? liveTable?.querySelectorAll("tr")[active.row]?.children[active.col]
      : null) as HTMLElement | null;
    const t = wrapperRel(s, cell ?? host);
    barEl.style.left = `${Math.max(4, t.left)}px`;
    s.ui.append(barEl);
    const h = barEl.offsetHeight || BAR_H;
    barEl.style.top = `${Math.max(toolbarFloor(), t.top - h - GAP)}px`;
    clampToWrapper(s, barEl);
  }

  function picks(): { tbl: TableNode; row: number; col: number; rows: number[]; cols: number[] } | null {
    if (!liveTable) return null;
    const tbl = findTableNode(s, liveTable);
    if (!tbl) return null;
    const row = active?.row ?? 0;
    const col = active?.col ?? 0;
    const rows = sel.length ? [...new Set(sel.map((p) => p.row))] : [row];
    const cols = sel.length ? [...new Set(sel.map((p) => p.col))] : [col];
    return { tbl, row, col, rows, cols };
  }

  function cellHV(): { h: string; v: string } {
    const p = picks();
    const cell = p ? p.tbl.rows[p.row]?.cells[p.col] : undefined;
    const ha = (cell?.blocks[0] as { align?: string } | undefined)?.align;
    const h = ha === "center" || ha === "right" || ha === "justify" ? ha : "left";
    return { h, v: cellVAlign(cell) };
  }

  function placeFly(b: HTMLButtonElement): void {
    if (!flyEl || !barEl) return;
    if (barEl.classList.contains("pde-toolbar-group")) {
      placeOverlay(b, flyEl);
      return;
    }
    const br = barEl.getBoundingClientRect();
    const wr = s.wrapper.getBoundingClientRect();
    flyEl.style.left = `${Math.max(4, b.getBoundingClientRect().left - wr.left)}px`;
    flyEl.style.top = `${Math.max(toolbarFloor(), br.bottom - wr.top + 4)}px`;
    s.ui.append(flyEl);
    clampToWrapper(s, flyEl);
  }

  function openFly(cls: string, btn: HTMLButtonElement, fill: (el: HTMLElement) => void): void {
    hideFly();
    flyEl = s.ownerDoc.createElement("div");
    flyEl.className = cls;
    fill(flyEl);
    placeFly(btn);
  }

  function fillBar(table: HTMLTableElement): void {
    if (!barEl) return;
    barEl.replaceChildren();
    const hint = s.ownerDoc.createElement("span");
    hint.className = "pde-table-bar-cell";
    const a = active ?? cellPick(s.currentBlockEl()?.closest("td, th") as HTMLElement | null);
    hint.textContent = a ? `R${a.row + 1}C${a.col + 1}` : "—";
    hint.title = "Active cell";
    barEl.append(hint);
    const add = (icon: Parameters<typeof barIconBtn>[1], label: string, fn: () => void, danger = false) =>
      barEl!.append(barIconBtn(s.ownerDoc, icon, label, fn, danger));
    barEl.append(barFlyBtn(s.ownerDoc, "rows3", "Rows and columns", (btn) => openFly("pde-block-menu pde-table-menu pde-table-rowcol-menu", btn, (host) => {
      const iconBtn = (icon: Parameters<typeof barIconBtn>[1], label: string, fn: () => void, danger = false) => {
        host.append(barIconBtn(s.ownerDoc, icon, label, () => { hideFly(); fn(); }, danger));
      };
      iconBtn("insertRowAbove", "Insert row above", () => { const p = picks(); if (p) tableOp(() => insertBlankRow(s, p.tbl, p.row, p.row)); });
      iconBtn("insertRowBelow", "Insert row below", () => { const p = picks(); if (p) tableOp(() => insertBlankRow(s, p.tbl, p.row, p.row + 1)); });
      iconBtn("insertColLeft", "Insert column left", () => { const p = picks(); if (p) tableOp(() => insertCol(s, p.tbl, p.col)); });
      iconBtn("insertColRight", "Insert column right", () => { const p = picks(); if (p) tableOp(() => insertCol(s, p.tbl, p.col + 1)); });
      const sep = s.ownerDoc.createElement("span");
      sep.className = "pde-style-sep";
      sep.setAttribute("aria-hidden", "true");
      sep.textContent = "|";
      host.append(sep);
      iconBtn("deleteRow", "Delete row", () => { const p = picks(); if (p) tableOp(() => deleteRows(p.tbl, p.rows)); }, true);
      iconBtn("deleteCol", "Delete column", () => { const p = picks(); if (p) tableOp(() => deleteCols(p.tbl, p.cols)); }, true);
      iconBtn("columns3", "Merge cell right", () => { const p = picks(); if (p) tableOp(() => mergeRight(p.tbl, p.row, p.col)); });
    })));
    const hv = cellHV();
    const look = picks()?.tbl ? resolvedLook(picks()!.tbl) : {};
    const dens = picks()?.tbl.style?.density ?? "normal";
    barEl.append(barFlyBtn(s.ownerDoc, "alignCenter", "Cell alignment", (btn) => openFly("pde-block-menu pde-table-menu", btn, (host) => {
      const targets = () => {
        const p = picks();
        return p ? (sel.length ? sel : [{ row: p.row, col: p.col }]) : [];
      };
      host.append(barAlignPad(s.ownerDoc, hv.h, hv.v, (a) => {
        hideFly();
        const p = picks();
        if (p) tableOp(() => forPickedCells(p.tbl, targets(), (c) => setCellTextAlign(c, a)));
      }, (a) => {
        hideFly();
        const p = picks();
        if (p) tableOp(() => forPickedCells(p.tbl, targets(), (c) => setCellVAlign(c, a)));
      }));
    }), hv.h !== "left" || hv.v !== "middle"));
    const densIcon = dens === "compact" ? "rowHCompact" : dens === "large" ? "rowHLarge" : "rowHNormal";
    barEl.append(barFlyBtn(s.ownerDoc, densIcon, "Row height", (btn) => openFly("pde-block-menu pde-table-menu", btn, (host) => {
      for (const [d, l, icon] of [
        ["compact", "Compact rows", "rowHCompact"],
        ["normal", "Normal rows", "rowHNormal"],
        ["large", "Large rows", "rowHLarge"],
      ] as const) {
        host.append(barMenuItem(s.ownerDoc, l, () => {
          hideFly();
          const p = picks();
          if (p) tableOp(() => applyDensity(p.tbl, d));
        }, dens === d, icon));
      }
    }), dens !== "normal"));
    barEl.append(barFlyBtn(s.ownerDoc, "table", "Table styles", (btn) => openFly("pde-block-menu pde-table-menu pde-table-style-menu", btn, (host) => {
      const p0 = picks();
      const liveLook = p0 ? resolvedLook(p0.tbl) : look;
      host.append(barTableStylePad(s.ownerDoc, liveLook, p0?.tbl.style?.preset, (key) => {
        hideFly();
        const p = picks();
        if (p) tableOp(() => toggleLook(p.tbl, key));
      }, (id) => {
        hideFly();
        const p = picks();
        if (p) tableOp(() => applyPreset(p.tbl, id));
      }));
    }), !!(picks()?.tbl.style?.preset && picks()!.tbl.style!.preset !== "plain") || Object.values(look).some(Boolean)));
    const picked = picks();
    const fillLive = picked ? cellFill(picked.tbl.rows[picked.row]?.cells[picked.col], picked.tbl, picked.row, picked.col) : undefined;
    barEl.append(barCellSwatch(s.ownerDoc, fillLive, (color) => {
      const p = picks();
      if (!p) return;
      tableOp(() => forPickedCells(p.tbl, sel.length ? sel : [{ row: p.row, col: p.col }], (c) => shadeCell(c, color)));
    }));
    add("eraser", "Clear selected cell styles", () => {
      const p = picks();
      if (!p) return;
      const targets = sel.length ? sel : [{ row: p.row, col: p.col }];
      tableOp(() => forPickedCells(p.tbl, targets, (c) => clearCellStyle(c)));
    });
    add("clearFormat", "Clear table styles", () => { const p = picks(); if (p) tableOp(() => clearTableStyle(p.tbl)); });
    add("trash", "Delete table", () => tableOp(() => {
      const found = findParentList(s.getDoc(), table.getAttribute("data-node-id") ?? "");
      if (found) found.list.splice(found.index, 1);
    }), true);
  }

  s.addBoth("click", ((e: MouseEvent) => {
    const el = e.target as HTMLElement | null;
    if (el?.closest?.(".pde-col-handle, .pde-row-handle, .pde-table-bar, .pde-table-menu")) return;
    const table = el?.closest?.("table.pde-table") as HTMLTableElement | null;
    if (!table || !s.container.contains(table)) { hideTableUi(); return; }
    const cell = el?.closest?.("td, th") as HTMLElement | null;
    const pick = cellPick(cell);
    if (pick && !didDrag) { active = pick; sel = [pick]; }
    didDrag = false;
    showChrome(table);
  }) as never);

  s.addBoth("pointerdown", ((e: PointerEvent) => {
    const cell = (e.target as HTMLElement)?.closest?.("td, th") as HTMLElement | null;
    const table = cell?.closest?.("table.pde-table") as HTMLTableElement | null;
    if (!table || !s.container.contains(table)) return;
    dragFrom = cellPick(cell);
    didDrag = false;
  }) as never);

  const onMove = (e: PointerEvent): void => {
    if (!dragFrom || !liveTable) return;
    const cell = (e.target as HTMLElement)?.closest?.("td, th") as HTMLElement | null;
    const table = cell?.closest("table.pde-table");
    if (table !== liveTable) return;
    const to = cellPick(cell);
    if (!to) return;
    if (to.row === dragFrom.row && to.col === dragFrom.col) return;
    didDrag = true;
    sel = expandDrag(liveTable, dragFrom, to);
    active = to;
    paintCellClasses(liveTable, sel, active);
    const hint = barEl?.querySelector(".pde-table-bar-cell");
    if (hint) hint.textContent = `R${active.row + 1}C${active.col + 1}`;
  };
  const onUp = (): void => { dragFrom = null; };
  s.ownerDoc.addEventListener("pointermove", onMove);
  s.ownerDoc.addEventListener("pointerup", onUp);
  s.cleanup.push(() => { s.ownerDoc.removeEventListener("pointermove", onMove); s.ownerDoc.removeEventListener("pointerup", onUp); });
  bindTableResize(s);
  return { hideTableUi };
}
