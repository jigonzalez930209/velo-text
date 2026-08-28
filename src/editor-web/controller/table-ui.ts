import { getIconSvg, type IconName } from "../../assets/icons/index.js";
import { normalizeDocument } from "../../core/normalize/normalize.js";
import type { TableLook, TableNode, TablePreset } from "../../core/model/types.js";
import { applyDensity, applyPreset, clearTableStyle, shadeCell, toggleLook } from "../../core/model/table-look.js";
import type { EditorState } from "./types.js";
import { bindTableResize, findTableNode, showTableResize, wrapperRel, clampToWrapper } from "./table-resize.js";
import { findParentList } from "./nesting.js";

export function attachTableUi(s: EditorState): { hideTableUi: () => void } {
  let tableMenuEl: HTMLElement | null = null;
  let resizeEl: HTMLElement | null = null;
    let gearEl: HTMLButtonElement | null = null;
  function hideResize(): void { resizeEl?.remove(); resizeEl = null; }
  function hideMenu(): void { tableMenuEl?.remove(); tableMenuEl = null; }
  function hideGear(): void { gearEl?.remove(); gearEl = null; }
  function hideTableUi(): void { hideMenu(); hideResize(); hideGear(); }

  function tableOp(mutate: () => void): void {
    s.pushSnapshot();
    mutate();
    s.setDoc(normalizeDocument(s.getDoc()));
    s.render();
    s.opts.onChange?.(s.getDoc());
  }

  function showChrome(table: HTMLTableElement): void {
    hideResize();
    hideGear();
    resizeEl = showTableResize(s, table);
    const t = wrapperRel(s, table);
    gearEl = s.ownerDoc.createElement("button");
    gearEl.type = "button";
    gearEl.className = "pde-table-btn";
    gearEl.title = "Table actions";
    gearEl.innerHTML = getIconSvg("table", { size: 14 });
    gearEl.style.left = `${Math.max(4, t.left + t.width - 28)}px`;
    gearEl.style.top = `${t.top}px`;
    gearEl.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      showTableMenu(table, t.left + t.width - 28, t.top + 28);
    };
    s.ui.append(gearEl);
    clampToWrapper(s, gearEl);
  }

  function showTableMenu(table: HTMLTableElement, x: number, y: number): void {
    hideMenu();
    const tblNode = findTableNode(s, table);
    if (!tblNode) return;
    tableMenuEl = s.ownerDoc.createElement("div");
    tableMenuEl.className = "pde-block-menu pde-table-menu";
    tableMenuEl.style.left = `${x}px`;
    tableMenuEl.style.top = `${y}px`;
    const curRow = s.currentBlockEl()?.closest("tr") as HTMLElement | null;
    const curCell = s.currentBlockEl()?.closest("td, th") as HTMLElement | null;
    const rowIndex = curRow ? Array.from(curRow.parentElement!.children).indexOf(curRow) : 0;
    const cellIndex = curCell ? Array.from(curCell.parentElement!.children).indexOf(curCell) : 0;
    const addBtn = (host: HTMLElement, icon: IconName, label: string, fn: () => void, danger = false): void => {
      const b = s.ownerDoc.createElement("button");
      b.type = "button";
      if (danger) b.classList.add("pde-menu-danger");
      b.innerHTML = `${getIconSvg(icon, { size: 16 })}<span>${label}</span>`;
      b.onclick = () => { fn(); hideMenu(); };
      host.appendChild(b);
    };
    const addSub = (icon: IconName, label: string, fill: (sub: HTMLElement) => void): void => {
      const wrap = s.ownerDoc.createElement("div");
      wrap.className = "pde-submenu-wrap";
      const b = s.ownerDoc.createElement("button");
      b.type = "button";
      b.className = "pde-submenu-trigger";
      b.innerHTML = `${getIconSvg(icon, { size: 16 })}<span>${label}</span>${getIconSvg("chevronDown", { size: 14 })}`;
      const sub = s.ownerDoc.createElement("div");
      sub.className = "pde-submenu";
      sub.hidden = true;
      fill(sub);
      b.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        for (const other of tableMenuEl!.querySelectorAll(".pde-submenu")) {
          if (other !== sub) (other as HTMLElement).hidden = true;
        }
        sub.hidden = !sub.hidden;
        clampToWrapper(s, tableMenuEl!);
      };
      wrap.append(b, sub);
      tableMenuEl!.appendChild(wrap);
    };
    addBtn(tableMenuEl, "rows3", "Insert row above", () => tableOp(() => cloneRow(s, tblNode, rowIndex, rowIndex)));
    addBtn(tableMenuEl, "rows3", "Insert row below", () => tableOp(() => cloneRow(s, tblNode, rowIndex, rowIndex + 1)));
    addBtn(tableMenuEl, "trash", "Delete row", () => tableOp(() => { if (tblNode.rows.length > 1) tblNode.rows.splice(rowIndex, 1); }), true);
    addBtn(tableMenuEl, "columns3", "Insert column left", () => tableOp(() => insertCol(s, tblNode, cellIndex)));
    addBtn(tableMenuEl, "columns3", "Insert column right", () => tableOp(() => insertCol(s, tblNode, cellIndex + 1)));
    addBtn(tableMenuEl, "trash", "Delete column", () => tableOp(() => {
      if (tblNode.columns.length > 1) {
        tblNode.columns.splice(cellIndex, 1);
        for (const row of tblNode.rows) row.cells.splice(cellIndex, 1);
      }
    }), true);
    addBtn(tableMenuEl, "columns3", "Merge cell right", () => tableOp(() => mergeRight(tblNode, rowIndex, cellIndex)));
    addBtn(tableMenuEl, "split", "Split merged cell", () => tableOp(() => splitCell(s, tblNode, rowIndex, cellIndex)));
    addSub("rows3", "Row height", (sub) => {
      addBtn(sub, "rows3", "Compact", () => tableOp(() => applyDensity(tblNode, "compact")));
      addBtn(sub, "rows3", "Normal", () => tableOp(() => applyDensity(tblNode, "normal")));
      addBtn(sub, "rows3", "Large", () => tableOp(() => applyDensity(tblNode, "large")));
    });
    addSub("table", "Style options", (sub) => {
      const looks: Array<[keyof TableLook, string]> = [
        ["headerRow", "Header row"],
        ["totalRow", "Total row"],
        ["bandedRows", "Banded rows"],
        ["firstColumn", "First column"],
        ["lastColumn", "Last column"],
        ["bandedColumns", "Banded columns"],
      ];
      for (const [key, label] of looks) addBtn(sub, "table", label, () => tableOp(() => toggleLook(tblNode, key)));
    });
    addSub("table", "Word-like styles", (sub) => {
      const presets: Array<[TablePreset, string]> = [
        ["plain", "Plain"],
        ["grid", "Grid"],
        ["grid-banded", "Grid banded"],
        ["list", "List"],
        ["list-header", "List header"],
        ["accent", "Accent"],
      ];
      for (const [id, label] of presets) addBtn(sub, "table", label, () => tableOp(() => applyPreset(tblNode, id)));
    });
    addBtn(tableMenuEl, "background", "Shade cell…", () => tableOp(() => {
      const cell = tblNode.rows[rowIndex]?.cells[cellIndex];
      if (!cell) return;
      const color = s.ownerDoc.defaultView?.prompt("Cell fill (#hex or empty to clear)", String(cell.style?.background ?? "#dbeafe"));
      shadeCell(cell, color?.trim() || undefined);
    }));
    addBtn(tableMenuEl, "eraser", "Clear table styles", () => tableOp(() => clearTableStyle(tblNode)));
    addBtn(tableMenuEl, "trash", "Delete table", () => tableOp(() => {
      const found = findParentList(s.getDoc(), tblNode.id ?? "");
      if (found) found.list.splice(found.index, 1);
    }), true);
    s.ui.append(tableMenuEl);
    clampToWrapper(s, tableMenuEl);
  }

  s.addBoth("click", ((e: MouseEvent) => {
    const el = e.target as HTMLElement | null;
    if (el?.closest?.(".pde-col-handle, .pde-row-handle, .pde-table-btn, .pde-table-menu")) return;
    const table = el?.closest?.("table.pde-table") as HTMLTableElement | null;
    if (!table || !s.container.contains(table)) { hideTableUi(); return; }
    showChrome(table);
  }) as never);

  const prevRender = s.render;
  s.render = () => {
    prevRender();
    for (const table of Array.from(s.container.querySelectorAll("table.pde-table")) as HTMLTableElement[]) {
      table.addEventListener("click", () => showChrome(table));
    }
  };

  bindTableResize(s);

  return { hideTableUi };
}

function cloneRow(s: EditorState, tbl: TableNode, srcIdx: number, atIdx: number): void {
  const src = tbl.rows[srcIdx];
  if (!src) return;
  const copy = JSON.parse(JSON.stringify(src)) as typeof src;
  copy.id = s.idGen.next();
  for (const c of copy.cells) c.id = s.idGen.next();
  tbl.rows.splice(Math.max(0, Math.min(atIdx, tbl.rows.length)), 0, copy);
}

function mergeRight(tbl: TableNode, rowIndex: number, cellIndex: number): void {
  const row = tbl.rows[rowIndex];
  const cell = row?.cells[cellIndex];
  const next = row?.cells[cellIndex + 1];
  if (!cell || !next) return;
  cell.colSpan = (cell.colSpan || 1) + (next.colSpan || 1);
  if (next.blocks) cell.blocks = [...(cell.blocks ?? []), ...next.blocks];
  row.cells.splice(cellIndex + 1, 1);
}

function splitCell(s: EditorState, tbl: TableNode, rowIndex: number, cellIndex: number): void {
  const row = tbl.rows[rowIndex];
  const cell = row?.cells[cellIndex];
  if (!cell || (cell.colSpan || 1) <= 1) return;
  const extra = cell.colSpan - 1;
  cell.colSpan = 1;
  for (let i = 0; i < extra; i++) {
    row.cells.splice(cellIndex + 1 + i, 0, {
      id: s.idGen.next(),
      colSpan: 1,
      blocks: [{ type: "paragraph", id: s.idGen.next(), children: [] }],
    } as never);
  }
}

function insertCol(s: EditorState, tbl: TableNode, atIdx: number): void {
  tbl.columns.splice(Math.max(0, atIdx), 0, { id: s.idGen.next(), widthUm: 40000 });
  for (const row of tbl.rows) {
    row.cells.splice(Math.max(0, atIdx), 0, {
      id: s.idGen.next(),
      colSpan: 1,
      blocks: [{ type: "paragraph", id: s.idGen.next(), children: [] }],
    } as never);
  }
}
