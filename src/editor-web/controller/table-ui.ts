import { getIconSvg, type IconName } from "../../assets/icons/index.js";
import { normalizeDocument } from "../../core/normalize/normalize.js";
import type { EditorState } from "./types.js";
import { bindTableResize, findTableNode, showTableResize, wrapperRel } from "./table-resize.js";
import { findParentList } from "./nesting.js";

interface TableLike {
  id?: string;
  columns: Array<{ id: string; widthUm: number }>;
  rows: Array<{ id: string; cells: Array<{ id: string; colSpan: number; blocks?: unknown[] }> }>;
}

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
    gearEl.style.left = `${t.left + t.width + 6}px`;
    gearEl.style.top = `${t.top}px`;
    gearEl.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      showTableMenu(table, t.left + t.width + 6, t.top + 28);
    };
    s.ui.append(gearEl);
  }

  function showTableMenu(table: HTMLTableElement, x: number, y: number): void {
    hideMenu();
    const tblNode = findTableNode(s, table) as unknown as TableLike | null;
    if (!tblNode) return;
    tableMenuEl = s.ownerDoc.createElement("div");
    tableMenuEl.className = "pde-block-menu pde-table-menu";
    tableMenuEl.style.left = `${x}px`;
    tableMenuEl.style.top = `${y}px`;
    const curRow = s.currentBlockEl()?.closest("tr") as HTMLElement | null;
    const curCell = s.currentBlockEl()?.closest("td, th") as HTMLElement | null;
    const rowIndex = curRow ? Array.from(curRow.parentElement!.children).indexOf(curRow) : 0;
    const cellIndex = curCell ? Array.from(curCell.parentElement!.children).indexOf(curCell) : 0;
    const addBtn = (icon: IconName, label: string, fn: () => void): void => {
      const b = s.ownerDoc.createElement("button");
      b.type = "button";
      b.innerHTML = `${getIconSvg(icon, { size: 16 })}<span>${label}</span>`;
      b.onclick = () => { fn(); hideMenu(); };
      tableMenuEl!.appendChild(b);
    };
    addBtn("rows3", "Insert row above", () => tableOp(() => cloneRow(s, tblNode, rowIndex, rowIndex)));
    addBtn("rows3", "Insert row below", () => tableOp(() => cloneRow(s, tblNode, rowIndex, rowIndex + 1)));
    addBtn("trash", "Delete row", () => tableOp(() => { if (tblNode.rows.length > 1) tblNode.rows.splice(rowIndex, 1); }));
    addBtn("columns3", "Insert column left", () => tableOp(() => insertCol(s, tblNode, cellIndex)));
    addBtn("columns3", "Insert column right", () => tableOp(() => insertCol(s, tblNode, cellIndex + 1)));
    addBtn("trash", "Delete column", () => tableOp(() => {
      if (tblNode.columns.length > 1) {
        tblNode.columns.splice(cellIndex, 1);
        for (const row of tblNode.rows) row.cells.splice(cellIndex, 1);
      }
    }));
    addBtn("trash", "Delete table", () => tableOp(() => {
      const found = findParentList(s.getDoc(), tblNode.id ?? "");
      if (found) found.list.splice(found.index, 1);
    }));
    s.ui.append(tableMenuEl);
  }

  s.addBoth("click", ((e: MouseEvent) => {
    const el = e.target as HTMLElement | null;
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

function cloneRow(s: EditorState, tbl: TableLike, srcIdx: number, atIdx: number): void {
  const src = tbl.rows[srcIdx];
  if (!src) return;
  const copy = JSON.parse(JSON.stringify(src)) as typeof src;
  copy.id = s.idGen.next();
  for (const c of copy.cells) c.id = s.idGen.next();
  tbl.rows.splice(Math.max(0, Math.min(atIdx, tbl.rows.length)), 0, copy);
}

function insertCol(s: EditorState, tbl: TableLike, atIdx: number): void {
  tbl.columns.splice(Math.max(0, atIdx), 0, { id: s.idGen.next(), widthUm: 40000 });
  for (const row of tbl.rows) {
    row.cells.splice(Math.max(0, atIdx), 0, {
      id: s.idGen.next(),
      colSpan: 1,
      blocks: [{ type: "paragraph", id: s.idGen.next(), children: [] }],
    } as never);
  }
}
