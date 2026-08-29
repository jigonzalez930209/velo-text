export interface TablePick {
  row: number;
  col: number;
}

export function cellPick(cell: HTMLElement | null): TablePick | null {
  if (!cell) return null;
  const tr = cell.closest("tr");
  const table = cell.closest("table.pde-table");
  if (!tr || !table) return null;
  const row = Array.from(table.querySelectorAll("tbody tr, tr")).indexOf(tr);
  const col = Number(cell.getAttribute("data-col-index") ?? Array.from(tr.children).indexOf(cell));
  if (row < 0 || col < 0) return null;
  return { row, col };
}

export function rectPicks(a: TablePick, b: TablePick): TablePick[] {
  const r0 = Math.min(a.row, b.row);
  const r1 = Math.max(a.row, b.row);
  const c0 = Math.min(a.col, b.col);
  const c1 = Math.max(a.col, b.col);
  const out: TablePick[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push({ row: r, col: c });
  return out;
}

/** Header-row drag → full columns; first-column drag → full rows. */
export function expandDrag(table: HTMLTableElement, a: TablePick, b: TablePick): TablePick[] {
  const rows = table.querySelectorAll("tbody tr, tr").length;
  const cols = table.querySelector("tr")?.children.length ?? 0;
  if (a.row === 0 && b.row === 0 && a.col !== b.col) {
    const c0 = Math.min(a.col, b.col);
    const c1 = Math.max(a.col, b.col);
    const out: TablePick[] = [];
    for (let r = 0; r < rows; r++) for (let c = c0; c <= c1; c++) out.push({ row: r, col: c });
    return out;
  }
  if (a.col === 0 && b.col === 0 && a.row !== b.row) {
    const r0 = Math.min(a.row, b.row);
    const r1 = Math.max(a.row, b.row);
    const out: TablePick[] = [];
    for (let r = r0; r <= r1; r++) for (let c = 0; c < cols; c++) out.push({ row: r, col: c });
    return out;
  }
  return rectPicks(a, b);
}

export function paintCellClasses(table: HTMLTableElement, sel: TablePick[], active: TablePick | null): void {
  for (const el of Array.from(table.querySelectorAll("td, th"))) {
    el.classList.remove("pde-cell-sel", "pde-cell-active");
  }
  const rows = Array.from(table.querySelectorAll("tbody tr, tr"));
  for (const p of sel) {
    const cell = rows[p.row]?.children[p.col] as HTMLElement | undefined;
    cell?.classList.add("pde-cell-sel");
  }
  if (active) {
    const cell = rows[active.row]?.children[active.col] as HTMLElement | undefined;
    cell?.classList.add("pde-cell-active");
  }
}
