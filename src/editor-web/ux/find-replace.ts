import { normalizeDocument } from "../../core/normalize/normalize.js";
import type { EditorState } from "../controller/types.js";
import { findTextHits, replaceTextInDocument } from "./find-text.js";

export function attachFindReplace(s: EditorState): { open: (replace?: boolean) => void; destroy: () => void } {
  let panel: HTMLElement | null = null;
  let cursor = 0;
  let lastQ = "";

  function destroy(): void { panel?.remove(); panel = null; clearMarks(); }

  function clearMarks(): void {
    for (const m of Array.from(s.container.querySelectorAll("mark.pde-find-hit"))) {
      const parent = m.parentNode;
      if (!parent) continue;
      parent.replaceChild(s.ownerDoc.createTextNode(m.textContent ?? ""), m);
      parent.normalize();
    }
  }

  function hits() {
    return findTextHits(s.getDoc(), lastQ);
  }

  function paint(): void {
    clearMarks();
    if (!lastQ) return;
    const list = hits();
    const count = panel?.querySelector("[data-count]") as HTMLElement | null;
    if (count) count.textContent = list.length ? `${cursor + 1}/${list.length}` : "0";
    const hit = list[cursor];
    if (!hit) return;
    const block = s.container.querySelector(`[data-node-id="${hit.blockId.replace(/"/g, "")}"]`) as HTMLElement | null;
    block?.scrollIntoView?.({ block: "center" });
    const root = block ?? s.container;
    const walker = s.ownerDoc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const t = node.textContent ?? "";
      const i = t.toLowerCase().indexOf(lastQ.toLowerCase());
      if (i < 0) continue;
      const range = s.ownerDoc.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + lastQ.length);
      const mark = s.ownerDoc.createElement("mark");
      mark.className = "pde-find-hit";
      try { range.surroundContents(mark); } catch { /* ignore */ }
      break;
    }
  }

  function applyReplace(all: boolean): void {
    if (!lastQ) return;
    s.pushSnapshot();
    const next = JSON.parse(JSON.stringify(s.getDoc()));
    const n = all ? 1_000_000 : 1;
    replaceTextInDocument(next, lastQ, (panel!.querySelector("[data-repl]") as HTMLInputElement).value, n);
    s.setDoc(normalizeDocument(next));
    s.render();
    s.opts.onChange?.(s.getDoc());
    cursor = 0;
    paint();
  }

  function open(replace = false): void {
    destroy();
    panel = s.ownerDoc.createElement("div");
    panel.className = "pde-find";
    panel.setAttribute("role", "search");
    panel.setAttribute("aria-label", "Find and replace");
    panel.innerHTML = `<input data-q type="search" aria-label="Find" placeholder="Find" />
      <input data-repl type="text" aria-label="Replace" placeholder="Replace" ${replace ? "" : 'hidden'} />
      <span data-count>0</span>
      <button type="button" data-prev aria-label="Previous">↑</button>
      <button type="button" data-next aria-label="Next">↓</button>
      <button type="button" data-one ${replace ? "" : "hidden"}>Replace</button>
      <button type="button" data-all ${replace ? "" : "hidden"}>All</button>
      <button type="button" data-x aria-label="Close">×</button>`;
    s.wrapper.appendChild(panel);
    const q = panel.querySelector("[data-q]") as HTMLInputElement;
    q.oninput = () => { lastQ = q.value; cursor = 0; paint(); };
    panel.querySelector("[data-next]")!.addEventListener("click", () => {
      const n = hits().length;
      if (n) { cursor = (cursor + 1) % n; paint(); }
    });
    panel.querySelector("[data-prev]")!.addEventListener("click", () => {
      const n = hits().length;
      if (n) { cursor = (cursor - 1 + n) % n; paint(); }
    });
    panel.querySelector("[data-one]")!.addEventListener("click", () => applyReplace(false));
    panel.querySelector("[data-all]")!.addEventListener("click", () => applyReplace(true));
    panel.querySelector("[data-x]")!.addEventListener("click", () => destroy());
    q.focus();
  }

  const onKey = (e: KeyboardEvent): void => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === "f" || e.key === "F") { e.preventDefault(); open(false); }
    if (e.key === "h" || e.key === "H") { e.preventDefault(); open(true); }
  };
  s.container.addEventListener("keydown", onKey);
  s.ownerDoc.addEventListener("keydown", onKey);

  return {
    open,
    destroy() {
      destroy();
      s.container.removeEventListener("keydown", onKey);
      s.ownerDoc.removeEventListener("keydown", onKey);
    },
  };
}
