import type { TableCell, TableDensity, TableLook, TableNode, TablePreset } from "./types.js";

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

export function tableClassName(block: TableNode): string {
  const st = block.style ?? {};
  const look = st.look ?? {};
  const parts = ["pde-table"];
  if (st.density) parts.push(`pde-table--${st.density}`);
  if (st.preset) parts.push(`pde-table--${st.preset}`);
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
  const look = { ...(tbl.style?.look ?? {}) };
  look[key] = !look[key];
  tbl.style = { ...tbl.style, look };
  if (key === "headerRow" && tbl.rows[0]) tbl.rows[0].header = !!look.headerRow;
}

export function shadeCell(cell: TableCell, color: string | undefined): void {
  cell.style = { ...cell.style };
  if (color) cell.style.background = color;
  else delete cell.style.background;
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
  if (typeof custom === "string" && custom) return custom;
  const look = tbl.style?.look ?? {};
  const last = tbl.rows.length - 1;
  if (look.headerRow && ri === 0) return "#3659e3";
  if (look.totalRow && ri === last) return "#e8efff";
  if (look.firstColumn && ci === 0 && ri > 0) return "#eef2ff";
  if (look.lastColumn && ci === (tbl.columns.length - 1) && ri > 0) return "#eef2ff";
  if (look.bandedRows && ri > 0 && ri % 2 === 0) return "#f4f7ff";
  if (look.bandedColumns && ci % 2 === 1 && ri > 0) return "#f7f8fa";
  return undefined;
}
