import { getIconSvg, type IconName } from "../../assets/icons/index.js";

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
): HTMLButtonElement {
  const b = barIconBtn(doc, icon, label, () => open(b));
  b.classList.add("pde-bar-drop");
  b.setAttribute("aria-haspopup", "true");
  b.innerHTML = `${getIconSvg(icon, { size: 16 })}${getIconSvg("chevronDown", { size: 10 })}`;
  return b;
}

export function barMenuItem(doc: Document, label: string, fn: () => void, on = false): HTMLButtonElement {
  const b = doc.createElement("button");
  b.type = "button";
  b.textContent = label;
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
