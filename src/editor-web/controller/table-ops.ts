import type { TableNode } from "../../core/model/types.js";
import type { EditorState } from "./types.js";

export function insertBlankRow(s: EditorState, tbl: TableNode, srcIdx: number, atIdx: number): void {
  const src = tbl.rows[srcIdx];
  if (!src) return;
  const row = {
    id: s.idGen.next(),
    ...(src.heightUm ? { heightUm: src.heightUm } : {}),
    cells: src.cells.map((c) => ({
      id: s.idGen.next(),
      colSpan: c.colSpan || 1,
      rowSpan: 1,
      blocks: [{ type: "paragraph" as const, id: s.idGen.next(), children: [{ type: "text" as const, id: s.idGen.next(), text: "" }] }],
    })),
  };
  tbl.rows.splice(Math.max(0, Math.min(atIdx, tbl.rows.length)), 0, row);
}

export function mergeRight(tbl: TableNode, rowIndex: number, cellIndex: number): void {
  const row = tbl.rows[rowIndex];
  const cell = row?.cells[cellIndex];
  const next = row?.cells[cellIndex + 1];
  if (!cell || !next) return;
  cell.colSpan = (cell.colSpan || 1) + (next.colSpan || 1);
  if (next.blocks) cell.blocks = [...(cell.blocks ?? []), ...next.blocks];
  row.cells.splice(cellIndex + 1, 1);
}

export function splitCell(s: EditorState, tbl: TableNode, rowIndex: number, cellIndex: number): void {
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

export function insertCol(s: EditorState, tbl: TableNode, atIdx: number): void {
  tbl.columns.splice(Math.max(0, atIdx), 0, { id: s.idGen.next(), widthUm: 40000 });
  for (const row of tbl.rows) {
    row.cells.splice(Math.max(0, atIdx), 0, {
      id: s.idGen.next(),
      colSpan: 1,
      blocks: [{ type: "paragraph", id: s.idGen.next(), children: [] }],
    } as never);
  }
}

export function deleteRows(tbl: TableNode, indices: number[]): void {
  const uniq = [...new Set(indices)].filter((i) => i >= 0 && i < tbl.rows.length).sort((a, b) => b - a);
  for (const i of uniq) {
    if (tbl.rows.length <= 1) break;
    tbl.rows.splice(i, 1);
  }
}

export function deleteCols(tbl: TableNode, indices: number[]): void {
  const uniq = [...new Set(indices)].filter((i) => i >= 0 && i < tbl.columns.length).sort((a, b) => b - a);
  for (const i of uniq) {
    if (tbl.columns.length <= 1) break;
    tbl.columns.splice(i, 1);
    for (const row of tbl.rows) row.cells.splice(i, 1);
  }
}

export function forPickedCells(tbl: TableNode, picks: Array<{ row: number; col: number }>, fn: (cell: NonNullable<TableNode["rows"][0]["cells"][0]>) => void): void {
  for (const p of picks) {
    const cell = tbl.rows[p.row]?.cells[p.col];
    if (cell) fn(cell);
  }
}

export function setCellTextAlign(cell: TableNode["rows"][0]["cells"][0], align: "left" | "center" | "right" | "justify"): void {
  for (const bl of cell.blocks) {
    if (bl.type === "paragraph" || bl.type === "heading" || bl.type === "quote") {
      (bl as { align?: string }).align = align;
    }
  }
}
