import { OFFICE_STANDARD, OFFICE_STANDARD_LABEL, OFFICE_THEME, snapOfficeHex } from "../../core/model/office-colors.js";

function swatch(doc: Document, hex: string, selected: string, onPick: (hex: string) => void): HTMLButtonElement {
  const b = doc.createElement("button");
  b.type = "button";
  b.className = "pde-color-swatch";
  b.dataset.officeHex = hex;
  b.setAttribute("aria-label", hex);
  b.title = hex;
  b.style.background = hex;
  if (hex === selected) b.setAttribute("aria-selected", "true");
  b.onmousedown = (ev) => ev.preventDefault();
  b.onclick = (ev) => {
    ev.stopPropagation();
    onPick(hex);
  };
  return b;
}

export function mountOfficePalette(
  doc: Document,
  opts: { selected?: string; onPick: (hex: string) => void },
): HTMLElement {
  const root = doc.createElement("div");
  root.className = "pde-color-palette";
  root.setAttribute("role", "listbox");
  root.setAttribute("aria-label", "Office colors");
  const selected = opts.selected ? snapOfficeHex(opts.selected) : "";
  OFFICE_THEME.forEach((row, i) => {
    const line = doc.createElement("div");
    line.className = "pde-color-row";
    for (const hex of row) line.append(swatch(doc, hex, selected, opts.onPick));
    root.append(line);
    if (i === 0) {
      const rule = doc.createElement("div");
      rule.className = "pde-color-rule";
      root.append(rule);
    }
  });
  const lab = doc.createElement("div");
  lab.className = "pde-color-label";
  lab.textContent = OFFICE_STANDARD_LABEL;
  root.append(lab);
  const std = doc.createElement("div");
  std.className = "pde-color-row";
  for (const hex of OFFICE_STANDARD) std.append(swatch(doc, hex, selected, opts.onPick));
  root.append(std);
  return root;
}
