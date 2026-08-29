import { buildPdfPages } from "../../export/pdf/layout-pages.js";
import { pdfPageMetrics } from "../../export/pdf/page-metrics.js";
import type { EditorState } from "../controller/types.js";

const PAGE_GAP_PX = 24;
/** CSS px per PDF point (96 dpi screen, 72 pt/in). Same MediaBox as PdfWriter. */
const PT_TO_PX = 96 / 72;

export function applyPagePreview(s: EditorState, on: boolean): string[] {
  const doc = s.getDoc();
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
  const m = pdfPageMetrics(doc);
  const pageH = Math.round(m.heightPt * PT_TO_PX);
  const mTop = Math.round(m.marginTopPt * PT_TO_PX);
  const mBot = Math.round(m.marginBottomPt * PT_TO_PX);
  s.wrapper.style.setProperty("--pde-page-w", `${Math.round(m.widthPt * PT_TO_PX)}px`);
  s.wrapper.style.setProperty("--pde-page-h", `${pageH}px`);
  s.wrapper.style.setProperty("--pde-page-gap", `${PAGE_GAP_PX}px`);
  s.wrapper.style.setProperty("--pde-m-t", `${mTop}px`);
  s.wrapper.style.setProperty("--pde-m-r", `${Math.round(m.marginRightPt * PT_TO_PX)}px`);
  s.wrapper.style.setProperty("--pde-m-b", `${mBot}px`);
  s.wrapper.style.setProperty("--pde-m-l", `${Math.round(m.marginLeftPt * PT_TO_PX)}px`);
  keepBlocksOnPage(s.container, pageH, mTop, mBot, PAGE_GAP_PX);
  const pdfPages = buildPdfPages(doc);
  const texts = [`PDF pages: ${pdfPages.length} (bytes from exportPdf / previewPdf)`];
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
