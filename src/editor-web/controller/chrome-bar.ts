import type { EditorState } from "./types.js";

export function findChromeToolbar(s: EditorState): HTMLElement | null {
  const host = s.wrapper.closest(".pde-host") ?? s.wrapper.parentElement;
  return (
    (host?.querySelector(".pde-toolbar") as HTMLElement | null) ??
    (s.ownerDoc.querySelector(".pde-toolbar") as HTMLElement | null)
  );
}

/** Park table/column chrome on the main toolbar when present. */
export function parkContextBar(s: EditorState, barEl: HTMLElement): boolean {
  const tb = findChromeToolbar(s);
  if (!tb) return false;
  barEl.classList.add("pde-toolbar-group");
  barEl.style.position = "static";
  barEl.style.left = "";
  barEl.style.top = "";
  barEl.style.right = "";
  barEl.style.bottom = "";
  tb.insertBefore(barEl, tb.querySelector("[data-pde-toolbar-end]") ?? null);
  return true;
}
