import { buildLayout } from "../../export/layout/index.js";
import { umToPx } from "../../export/layout/units.js";
import type { EditorState } from "../controller/types.js";

export function applyPagePreview(s: EditorState, on: boolean): string[] {
  const page = s.getDoc().page;
  s.wrapper.classList.toggle("pde-page-preview", on);
  if (!on) {
    s.wrapper.style.removeProperty("--pde-page-w");
    s.wrapper.style.removeProperty("--pde-page-h");
    s.wrapper.style.removeProperty("--pde-m-t");
    s.wrapper.style.removeProperty("--pde-m-r");
    s.wrapper.style.removeProperty("--pde-m-b");
    s.wrapper.style.removeProperty("--pde-m-l");
    s.wrapper.querySelector(".pde-page-diag")?.remove();
    return [];
  }
  s.wrapper.style.setProperty("--pde-page-w", `${Math.round(umToPx(page.widthUm))}px`);
  s.wrapper.style.setProperty("--pde-page-h", `${Math.round(umToPx(page.heightUm))}px`);
  s.wrapper.style.setProperty("--pde-m-t", `${Math.round(umToPx(page.marginUm.top))}px`);
  s.wrapper.style.setProperty("--pde-m-r", `${Math.round(umToPx(page.marginUm.right))}px`);
  s.wrapper.style.setProperty("--pde-m-b", `${Math.round(umToPx(page.marginUm.bottom))}px`);
  s.wrapper.style.setProperty("--pde-m-l", `${Math.round(umToPx(page.marginUm.left))}px`);
  const layout = buildLayout(s.getDoc());
  const texts = layout.diagnostics.map((d) => d.message);
  s.wrapper.querySelector(".pde-page-diag")?.remove();
  if (texts.length) {
    const el = s.ownerDoc.createElement("div");
    el.className = "pde-page-diag";
    el.textContent = texts.join(" · ");
    s.wrapper.appendChild(el);
  }
  return texts;
}
