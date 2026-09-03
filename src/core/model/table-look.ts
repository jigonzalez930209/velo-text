import type { TableCell, TableDensity, TableLook, TableNode, TablePreset } from "./types.js";
import { cssToHex6, snapOfficeHex } from "./office-colors.js";

export const DENSITY_UM: Record<TableDensity, number> = { compact: 7000, normal: 11000, large: 16000 };
export const DENSITY_PT: Record<TableDensity, number> = { compact: 18, normal: 28, large: 42 };

const PRESET_LOOK: Record<TablePreset, TableLook> = {
  plain: {},
  grid: { headerRow: true },
  "grid-banded": { headerRow: true, bandedRows: true },
  list: { headerRow: true },
  "list-header": { headerRow: true, firstColumn: true },
  accent: { headerRow: true, bandedRows: true, firstColumn: true },
};

export function resolvedLook(tbl: TableNode): TableLook {
  const preset = tbl.style?.preset;
  const fromPreset = preset && preset !== "plain" ? PRESET_LOOK[preset] : {};
  return { ...fromPreset, ...(tbl.style?.look ?? {}) };
}

export function tableClassName(block: TableNode): string {
  const st = block.style ?? {};
  const look = resolvedLook(block);
  const parts = ["pde-table"];
  if (st.density) parts.push(`pde-table--${st.density}`);
  if (st.preset) parts.push(`pde-table--${st.preset}`);
  if (look.headerRow) parts.push("pde-table--header-row");
  if (look.bandedRows) parts.push("pde-table--banded-rows");
  if (look.bandedColumns) parts.push("pde-table--banded-cols");
  if (look.firstColumn) parts.push("pde-table--first-col");
  if (look.lastColumn) parts.push("pde-table--last-col");
  if (look.totalRow) parts.push("pde-table--total-row");
  return parts.join(" ");
}

export function applyDensity(tbl: TableNode, density: TableDensity): void {
  tbl.style = { ...tbl.style, density };
  const um = DENSITY_UM[density];
  for (const row of tbl.rows) row.heightUm = um;
}

export function applyPreset(tbl: TableNode, preset: TablePreset): void {
  const look = { ...PRESET_LOOK[preset] };
  tbl.style = { ...tbl.style, preset, look };
  if (tbl.rows[0]) tbl.rows[0].header = !!look.headerRow;
}

export function toggleLook(tbl: TableNode, key: keyof TableLook): void {
  const look = { ...resolvedLook(tbl) };
  look[key] = !look[key];
  tbl.style = { ...tbl.style, look };
  if (key === "headerRow" && tbl.rows[0]) tbl.rows[0].header = !!look.headerRow;
}

export type CellVAlign = "top" | "middle" | "bottom";

export function cellVAlign(cell: TableCell | undefined): CellVAlign {
  const v = cell?.style?.vAlign;
  return v === "top" || v === "bottom" ? v : "middle";
}

export function setCellVAlign(cell: TableCell, vAlign: CellVAlign): void {
  cell.style = { ...cell.style, vAlign };
}

export function shadeCell(cell: TableCell, color: string | undefined): void {
  cell.style = { ...cell.style };
  if (color) cell.style.background = snapOfficeHex(color);
  else delete cell.style.background;
}

export function clearCellStyle(cell: TableCell): void {
  for (const bl of cell.blocks) {
    if (bl.type === "paragraph" || bl.type === "heading" || bl.type === "quote") delete (bl as { align?: string }).align;
  }
  if (!cell.style) return;
  delete cell.style.background;
  delete cell.style.vAlign;
  if (!Object.keys(cell.style).length) delete cell.style;
}

export function clearTableStyle(tbl: TableNode): void {
  tbl.style = {};
  if (tbl.rows[0]) tbl.rows[0].header = true;
  for (const row of tbl.rows) {
    delete row.heightUm;
    for (const cell of row.cells) {
      if (cell.style) delete cell.style.background;
    }
  }
}

/** Shared editor + PDF fills. Do not persist these on `cell.style.background`. */
export const TABLE_FILLS = {
  header: "#3659e3",
  firstCol: "#eef2ff",
  total: "#e8efff",
  bandedRow: "#f4f7ff",
  bandedCol: "#f7f8fa",
} as const;

export const TABLE_HEADER_FG = "#ffffff";

const LOOK_CLASS: Record<keyof TableLook, string> = {
  headerRow: "pde-table--header-row",
  bandedRows: "pde-table--banded-rows",
  bandedColumns: "pde-table--banded-cols",
  firstColumn: "pde-table--first-col",
  lastColumn: "pde-table--last-col",
  totalRow: "pde-table--total-row",
};

export function lookFromTableClass(className: string, _preset?: TablePreset): TableLook {
  const look: TableLook = {};
  (Object.keys(LOOK_CLASS) as Array<keyof TableLook>).forEach((key) => {
    if (className.includes(LOOK_CLASS[key])) look[key] = true;
  });
  return look;
}

export function cssColorToHex(color: string): string | undefined {
  return cssToHex6(color);
}

export function isTableLookFill(color: string): boolean {
  const hex = cssColorToHex(color);
  if (!hex) return false;
  return (Object.values(TABLE_FILLS) as string[]).includes(hex);
}

export function hexToRgb01(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  if (h.length !== 6 && h.length !== 3) return null;
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return null;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function cellFill(cell: TableCell | undefined, tbl: TableNode, ri: number, ci: number): string | undefined {
  const custom = cell?.style?.background;
  if (typeof custom === "string" && custom) return snapOfficeHex(custom);
  const look = resolvedLook(tbl);
  const last = tbl.rows.length - 1;
  if (look.headerRow && ri === 0) return TABLE_FILLS.header;
  if (look.totalRow && ri === last) return TABLE_FILLS.total;
  if (look.firstColumn && ci === 0 && ri > 0) return TABLE_FILLS.firstCol;
  if (look.lastColumn && ci === (tbl.columns.length - 1) && ri > 0) return TABLE_FILLS.firstCol;
  if (look.bandedRows && ri > 0 && ri % 2 === 0) return TABLE_FILLS.bandedRow;
  if (look.bandedColumns && ci % 2 === 1 && ri > 0) return TABLE_FILLS.bandedCol;
  return undefined;
}
