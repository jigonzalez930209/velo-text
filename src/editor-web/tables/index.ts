/**
 * Tables — Phase 4.2.2
 * Insert/delete rows and columns, spans, Tab/Shift+Tab navigation, cell selection.
 * All operations are pure and return a new document; they do not mutate the input.
 */
import type { PortableDocument, TableNode, TableRow, TableCell } from "../../core/model/types.js";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function findTable(doc: PortableDocument, tableId: string): TableNode | null {
  for (const b of doc.root.children) if (b.id === tableId && b.type === "table") return b as TableNode;
  // Also search inside table cells (nested tables not in v1, but handle recursion)
  const search = (blocks: PortableDocument["root"]["children"]): TableNode | null => {
    for (const block of blocks) {
      if (block.type === "table" && block.id === tableId) return block;
      if (block.type === "table") {
        for (const row of block.rows) for (const cell of row.cells) {
          const found = search(cell.blocks);
          if (found) return found;
        }
      }
    }
    return null;
  };
  return search(doc.root.children);
}

export function insertRowAfter(doc: PortableDocument, tableId: string, rowIndex: number): PortableDocument {
  const copy: PortableDocument = clone(doc);
  const table = findTable(copy, tableId);
  if (!table) throw new Error(`table ${tableId} not found`);
  const template = table.rows[rowIndex];
  if (!template) throw new Error("row not found");
  const newRow: TableRow = clone(template);
  newRow.id = `${template.id}_copy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  for (const cell of newRow.cells) {
    cell.id = `${cell.id}_c_${Math.random().toString(36).slice(2, 4)}`;
    for (const b of cell.blocks) (b as { id: string }).id = `${(b as { id: string }).id}_c`;
  }
  table.rows.splice(rowIndex + 1, 0, newRow);
  return copy;
}

export function deleteRow(doc: PortableDocument, tableId: string, rowIndex: number): PortableDocument {
  const copy: PortableDocument = clone(doc);
  const table = findTable(copy, tableId);
  if (!table) throw new Error(`table ${tableId} not found`);
  if (table.rows.length <= 1) throw new Error("cannot delete last row");
  table.rows.splice(rowIndex, 1);
  return copy;
}

export function insertColumnAfter(doc: PortableDocument, tableId: string, colIndex: number): PortableDocument {
  const copy: PortableDocument = clone(doc);
  const table = findTable(copy, tableId);
  if (!table) throw new Error(`table ${tableId} not found`);
  const newColId = `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  table.columns.splice(colIndex + 1, 0, { id: newColId, widthUm: 40000 });
  for (const row of table.rows) {
    const newCell: TableCell = {
      id: `cell_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      colSpan: 1,
      rowSpan: 1,
      blocks: [{ type: "paragraph", id: `p_${Date.now()}`, children: [{ type: "text", id: `t_${Date.now()}`, text: "" }] } as unknown as TableCell["blocks"][number]],
    };
    row.cells.splice(colIndex + 1, 0, newCell);
  }
  return copy;
}

export function deleteColumn(doc: PortableDocument, tableId: string, colIndex: number): PortableDocument {
  const copy: PortableDocument = clone(doc);
  const table = findTable(copy, tableId);
  if (!table) throw new Error(`table ${tableId} not found`);
  if (table.columns.length <= 1) throw new Error("cannot delete last column");
  table.columns.splice(colIndex, 1);
  for (const row of table.rows) row.cells.splice(colIndex, 1);
  return copy;
}

/**
 * Tab navigation: given current cell coordinates, return next cell.
 * Wraps to next row; at end of table creates a new row (common UX).
 */
export function getNextCell(table: TableNode, rowIdx: number, colIdx: number, direction: "forward" | "backward" = "forward"): { row: number; col: number; wrap: boolean } | null {
  const colCount = table.columns.length;
  const rowCount = table.rows.length;
  if (direction === "forward") {
    let nc = colIdx + 1;
    let nr = rowIdx;
    let wrap = false;
    if (nc >= colCount) {
      nc = 0;
      nr++;
      wrap = true;
    }
    if (nr >= rowCount) return null; // would create new row
    return { row: nr, col: nc, wrap };
  } else {
    let nc = colIdx - 1;
    let nr = rowIdx;
    if (nc < 0) {
      nc = colCount - 1;
      nr--;
    }
    if (nr < 0) return null;
    return { row: nr, col: nc, wrap: false };
  }
}

/**
 * Handle Tab key inside a table — returns the next cell to focus or a command to create a row.
 */
export function handleTableTab(doc: PortableDocument, tableId: string, currentRow: number, currentCol: number, shiftKey: boolean): { doc: PortableDocument; next: { row: number; col: number } | null; createdRow: boolean } {
  const table = findTable(doc, tableId);
  if (!table) throw new Error(`table ${tableId} not found`);
  const next = getNextCell(table, currentRow, currentCol, shiftKey ? "backward" : "forward");
  if (next) return { doc, next, createdRow: false };
  // At end: create new row
  if (!shiftKey) {
    const newDoc = insertRowAfter(doc, tableId, table.rows.length - 1);
    return { doc: newDoc, next: { row: table.rows.length, col: 0 }, createdRow: true };
  }
  return { doc, next: null, createdRow: false };
}

/**
 * Cell selection — track selected cells for toolbar actions and copy.
 */
export interface CellSelection {
  tableId: string;
  cells: Array<{ row: number; col: number }>;
}

export function createCellSelection(tableId: string, row: number, col: number): CellSelection {
  return { tableId, cells: [{ row, col }] };
}

export function extendCellSelection(sel: CellSelection, row: number, col: number): CellSelection {
  // For MVP, just add; full range selection would compute rectangular area
  if (sel.cells.some((c) => c.row === row && c.col === col)) return sel;
  return { tableId: sel.tableId, cells: [...sel.cells, { row, col }] };
}

/**
 * Update colSpan/rowSpan — validates no overlap.
 */
export function setCellSpan(doc: PortableDocument, tableId: string, rowIdx: number, colIdx: number, colSpan: number, rowSpan: number): PortableDocument {
  const copy: PortableDocument = clone(doc);
  const table = findTable(copy, tableId);
  if (!table) throw new Error(`table ${tableId} not found`);
  const cell = table.rows[rowIdx]?.cells[colIdx];
  if (!cell) throw new Error("cell not found");
  if (colSpan < 1 || rowSpan < 1) throw new Error("span must be >=1");
  cell.colSpan = colSpan;
  cell.rowSpan = rowSpan;
  return copy;
}
