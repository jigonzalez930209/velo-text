import { buildLayout } from "../../export/layout/index.js";
import { umToPx } from "../../export/layout/units.js";
import type { EditorState } from "../controller/types.js";

const PAGE_GAP_PX = 24;

export function applyPagePreview(s: EditorState, on: boolean): string[] {
  const page = s.getDoc().page;
  s.wrapper.classList.toggle("pde-page-preview", on);
  if (!on) {
    s.wrapper.style.removeProperty("--pde-page-w");
    s.wrapper.style.removeProperty("--pde-page-h");
    s.wrapper.style.removeProperty("--pde-page-gap");
    s.wrapper.style.removeProperty("--pde-m-t");
    s.wrapper.style.removeProperty("--pde-m-r");
    s.wrapper.style.removeProperty("--pde-m-b");
    s.wrapper.style.removeProperty("--pde-m-l");
    s.wrapper.querySelector(".pde-page-diag")?.remove();
    clearKeepTogether(s.container);
    return [];
  }
  const pageH = Math.round(umToPx(page.heightUm));
  const mTop = Math.round(umToPx(page.marginUm.top));
  const mBot = Math.round(umToPx(page.marginUm.bottom));
  s.wrapper.style.setProperty("--pde-page-w", `${Math.round(umToPx(page.widthUm))}px`);
  s.wrapper.style.setProperty("--pde-page-h", `${pageH}px`);
  s.wrapper.style.setProperty("--pde-page-gap", `${PAGE_GAP_PX}px`);
  s.wrapper.style.setProperty("--pde-m-t", `${mTop}px`);
  s.wrapper.style.setProperty("--pde-m-r", `${Math.round(umToPx(page.marginUm.right))}px`);
  s.wrapper.style.setProperty("--pde-m-b", `${mBot}px`);
  s.wrapper.style.setProperty("--pde-m-l", `${Math.round(umToPx(page.marginUm.left))}px`);
  keepBlocksOnPage(s.container, pageH, mTop, mBot, PAGE_GAP_PX);
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

export function clearKeepTogether(container: HTMLElement): void {
  for (const node of Array.from(container.children)) {
    const el = node as HTMLElement;
    if (el.dataset.pdeKeep) {
      el.style.marginTop = "";
      delete el.dataset.pdeKeep;
    }
  }
}

/** Push a block to the next page when it would be split by a page band. */
export function keepBlocksOnPage(
  container: HTMLElement,
  pageH: number,
  mTop: number,
  mBot: number,
  gap: number,
): void {
  if (pageH <= 0) return;
  const cycle = pageH + gap;
  const usable = Math.max(24, pageH - mTop - mBot);
  clearKeepTogether(container);
  for (const node of Array.from(container.children)) {
    const el = node as HTMLElement;
    if (el.dataset.pdeUi) continue;
    const top = el.offsetTop;
    const h = el.offsetHeight;
    if (h <= 0) continue;
    const inCycle = ((top % cycle) + cycle) % cycle;
    const isBreak = el.getAttribute("data-node-type") === "page-break";
    if (isBreak) {
      const rest = pageH - inCycle;
      const push = Math.max(0, rest + gap);
      if (push > 1) {
        el.style.marginTop = `${Math.round(push)}px`;
        el.dataset.pdeKeep = "1";
      }
      continue;
    }
    if (inCycle >= pageH) {
      const push = cycle - inCycle + mTop;
      el.style.marginTop = `${Math.round(push)}px`;
      el.dataset.pdeKeep = "1";
      continue;
    }
    const room = pageH - mBot - inCycle;
    if (h > room && h <= usable && inCycle > mTop) {
      const push = room + mBot + gap + mTop;
      el.style.marginTop = `${Math.round(push)}px`;
      el.dataset.pdeKeep = "1";
    }
  }
}
