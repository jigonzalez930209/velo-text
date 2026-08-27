/**
 * Tablas — Fase 4.2.2
 * Insertar/eliminar filas y columnas, spans, navegación Tab
 */
import type { PortableDocument } from "../../core/model/types.js";

export function insertRowAfter(doc: PortableDocument, tableId: string, rowIndex: number): PortableDocument {
  const copy: PortableDocument = JSON.parse(JSON.stringify(doc));
  const table = findTable(copy, tableId);
  if (!table) throw new Error(`table ${tableId} not found`);
  const template = table.rows[rowIndex];
  if (!template) throw new Error("row not found");
  const newRow = JSON.parse(JSON.stringify(template)) as typeof template;
  newRow.id = `${template.id}_copy_${Date.now()}`;
  for (const cell of newRow.cells as Array<{ id: string; blocks: Array<{ id: string }> }>) {
    cell.id = `${cell.id}_c`;
    for (const b of cell.blocks) (b as { id: string }).id = `${(b as { id: string }).id}_c`;
  }
  table.rows.splice(rowIndex + 1, 0, newRow);
  return copy;
}

export function deleteRow(doc: PortableDocument, tableId: string, rowIndex: number): PortableDocument {
  const copy: PortableDocument = JSON.parse(JSON.stringify(doc));
  const table = findTable(copy, tableId);
  if (!table) throw new Error(`table ${tableId} not found`);
  if (table.rows.length <= 1) throw new Error("cannot delete last row");
  table.rows.splice(rowIndex, 1);
  return copy;
}

function findTable(doc: PortableDocument, tableId: string): (PortableDocument["root"]["children"][number] & { rows: Array<{ id: string; cells: unknown[] }>; columns: unknown[] }) | null {
  for (const b of doc.root.children) if (b.id === tableId && b.type === "table") return b as unknown as ReturnType<typeof findTable> & {};
  return null;
}
