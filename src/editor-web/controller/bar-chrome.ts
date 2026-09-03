import { getIconSvg, type IconName } from "../../assets/icons/index.js";
import type { TableLook, TablePreset } from "../../core/model/types.js";
import { snapOfficeHex } from "../../core/model/office-colors.js";
import { mountOfficePalette } from "./color-palette.js";
import { placeOverlay } from "./place-overlay.js";

let openFillPalette: HTMLElement | null = null;
let fillPaletteDismiss: ((ev: Event) => void) | null = null;

export function closeCellFillPalette(): void {
  if (fillPaletteDismiss && openFillPalette) {
    openFillPalette.ownerDocument.removeEventListener("mousedown", fillPaletteDismiss, true);
  }
  fillPaletteDismiss = null;
  openFillPalette?.remove();
  openFillPalette = null;
}

export function barIconBtn(
  doc: Document,
  icon: IconName,
  label: string,
  fn: () => void,
  danger = false,
): HTMLButtonElement {
  const b = doc.createElement("button");
  b.type = "button";
  b.innerHTML = getIconSvg(icon, { size: 16 });
  b.title = label;
  b.setAttribute("aria-label", label);
  if (danger) b.classList.add("pde-menu-danger");
  b.onmousedown = (ev) => ev.preventDefault();
  b.onclick = (ev) => { ev.stopPropagation(); fn(); };
  return b;
}

export function barFlyBtn(
  doc: Document,
  icon: IconName,
  label: string,
  open: (btn: HTMLButtonElement) => void,
  on = false,
): HTMLButtonElement {
  const b = barIconBtn(doc, icon, label, () => open(b));
  b.classList.add("pde-bar-drop");
  b.setAttribute("aria-haspopup", "true");
  b.innerHTML = `${getIconSvg(icon, { size: 16 })}${getIconSvg("chevronDown", { size: 10 })}`;
  if (on) b.setAttribute("aria-pressed", "true");
  return b;
}

export function barMenuItem(doc: Document, label: string, fn: () => void, on = false, icon?: IconName): HTMLButtonElement {
  const b = doc.createElement("button");
  b.type = "button";
  b.innerHTML = icon ? `${getIconSvg(icon, { size: 16 })}<span>${label}</span>` : label;
  b.setAttribute("aria-label", label);
  if (on) {
    b.classList.add("pde-menu-on");
    b.setAttribute("aria-pressed", "true");
  }
  b.onclick = (ev) => { ev.stopPropagation(); fn(); };
  return b;
}

const H_ICONS: Array<[IconName, string, "left" | "center" | "right" | "justify"]> = [
  ["alignLeft", "Text left", "left"],
  ["alignCenter", "Text center", "center"],
  ["alignRight", "Text right", "right"],
  ["alignJustify", "Justify", "justify"],
];
const V_ICONS: Array<[IconName, string, "top" | "middle" | "bottom"]> = [
  ["alignTop", "Align top", "top"],
  ["alignMiddle", "Align middle", "middle"],
  ["alignBottom", "Align bottom", "bottom"],
];

export function barTableStylePad(
  doc: Document,
  look: TableLook,
  preset: TablePreset | undefined,
  onLook: (key: keyof TableLook) => void,
  onPreset: (id: TablePreset) => void,
): HTMLElement {
  const wrap = doc.createElement("div");
  wrap.className = "pde-style-pad";
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "Table styles");
  const looks: Array<[keyof TableLook, IconName, string]> = [
    ["headerRow", "heading1", "Header row"],
    ["totalRow", "minus", "Total row"],
    ["bandedRows", "rows3", "Banded rows"],
    ["firstColumn", "panelLeft", "First column"],
    ["lastColumn", "columns3", "Last column"],
    ["bandedColumns", "table", "Banded columns"],
  ];
  const looksRow = doc.createElement("span");
  looksRow.className = "pde-style-row";
  for (const [key, icon, label] of looks) {
    const b = barIconBtn(doc, icon, label, () => onLook(key));
    if (look[key]) b.setAttribute("aria-pressed", "true");
    looksRow.append(b);
  }
  const sep = doc.createElement("span");
  sep.className = "pde-style-sep";
  sep.setAttribute("aria-hidden", "true");
  sep.textContent = "|";
  const presets: Array<[TablePreset, IconName, string]> = [
    ["plain", "eraser", "Plain"],
    ["grid", "table", "Grid"],
    ["grid-banded", "rows3", "Grid banded"],
    ["list", "listUnordered", "List"],
    ["list-header", "heading1", "List header"],
    ["accent", "palette", "Accent"],
  ];
  const presetRow = doc.createElement("span");
  presetRow.className = "pde-style-row";
  for (const [id, icon, label] of presets) {
    const b = barIconBtn(doc, icon, label, () => onPreset(id));
    if ((preset ?? "plain") === id) b.setAttribute("aria-pressed", "true");
    presetRow.append(b);
  }
  wrap.append(looksRow, sep, presetRow);
  return wrap;
}

export function barCellSwatch(
  doc: Document,
  current: string | undefined,
  onFill: (color: string) => void,
): HTMLElement {
  const wrap = doc.createElement("span");
  wrap.className = "pde-cell-swatch-wrap";
  const btn = doc.createElement("button");
  btn.type = "button";
  btn.className = "pde-cell-swatch";
  btn.title = "Cell fill";
  btn.setAttribute("aria-label", "Cell fill");
  btn.setAttribute("aria-haspopup", "true");
  const hex = current ? snapOfficeHex(current) : "#ffffff";
  btn.style.setProperty("--pde-cell-fill", hex);
  btn.innerHTML = getIconSvg("paintBucket", { size: 16 });
  if (current && snapOfficeHex(current) !== "#ffffff") btn.setAttribute("aria-pressed", "true");
  btn.onmousedown = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (openFillPalette) {
      closeCellFillPalette();
      return;
    }
    const pal = mountOfficePalette(doc, {
      selected: hex,
      onPick: (c) => {
        closeCellFillPalette();
        btn.style.setProperty("--pde-cell-fill", c);
        btn.setAttribute("aria-pressed", "true");
        onFill(c);
      },
    });
    pal.classList.add("pde-color-palette-float");
    pal.style.display = "flex";
    pal.style.flexDirection = "column";
    pal.style.zIndex = "10000";
    pal.style.background = "var(--pde-color-bg, #fff)";
    pal.style.border = "1px solid var(--pde-color-border, #d8dce3)";
    pal.style.borderRadius = "6px";
    pal.style.boxShadow = "var(--pde-shadow-panel, 0 8px 24px rgb(0 0 0 / 18%))";
    pal.style.minWidth = "168px";
    placeOverlay(btn, pal);
    openFillPalette = pal;
    queueMicrotask(() => {
      fillPaletteDismiss = (e: Event) => {
        const t = e.target as Node | null;
        if (t && (pal.contains(t) || btn.contains(t))) return;
        closeCellFillPalette();
      };
      doc.addEventListener("mousedown", fillPaletteDismiss, true);
    });
  };
  btn.onclick = (ev) => ev.stopPropagation();
  wrap.append(btn);
  return wrap;
}

export function barAlignPad(
  doc: Document,
  h: string,
  v: string,
  onH: (a: "left" | "center" | "right" | "justify") => void,
  onV: (a: "top" | "middle" | "bottom") => void,
): HTMLElement {
  const wrap = doc.createElement("span");
  wrap.className = "pde-align-pad";
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "Cell alignment");
  for (const [icon, label, a] of H_ICONS) {
    const b = barIconBtn(doc, icon, label, () => onH(a));
    if (h === a) b.setAttribute("aria-pressed", "true");
    wrap.append(b);
  }
  for (const [icon, label, a] of V_ICONS) {
    const b = barIconBtn(doc, icon, label, () => onV(a));
    if (v === a) b.setAttribute("aria-pressed", "true");
    wrap.append(b);
  }
  return wrap;
}

export function barCellFillPad(
  doc: Document,
  current: string | undefined,
  onFill: (color: string) => void,
  onClear: () => void,
): HTMLElement {
  const wrap = doc.createElement("div");
  wrap.className = "pde-cell-fill-pad";
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "Cell fill");
  const row = doc.createElement("label");
  row.className = "pg-tb-row";
  row.title = "Cell fill";
  const inp = doc.createElement("input");
  inp.type = "color";
  inp.setAttribute("aria-label", "Cell fill color");
  inp.value = current && /^#[0-9a-f]{6}$/i.test(current) ? current : "#dbeafe";
  inp.onmousedown = (ev) => ev.stopPropagation();
  inp.addEventListener("input", (ev) => {
    ev.stopPropagation();
    onFill(inp.value);
  });
  const caption = doc.createElement("span");
  caption.textContent = "Fill";
  row.append(caption, inp);
  wrap.append(row, barMenuItem(doc, "Clear fill", onClear));
  return wrap;
}
