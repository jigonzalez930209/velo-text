import type { EditorState } from "../controller/types.js";

export interface PaletteItem {
  id: string;
  label: string;
  run: () => void;
}

export function attachCommandPalette(s: EditorState, items: () => PaletteItem[]): { open: () => void; destroy: () => void } {
  let panel: HTMLElement | null = null;
  let idx = 0;
  let ignoreOutside = false;

  function hide(): void {
    panel?.remove();
    panel = null;
  }

  function filtered(q: string): PaletteItem[] {
    const n = q.trim().toLowerCase();
    const all = items();
    return n ? all.filter((i) => i.label.toLowerCase().includes(n) || i.id.includes(n)) : all;
  }

  function renderList(q: string): void {
    if (!panel) return;
    const list = panel.querySelector("[data-list]") as HTMLElement;
    const rows = filtered(q);
    idx = Math.max(0, Math.min(idx, Math.max(0, rows.length - 1)));
    list.innerHTML = "";
    rows.forEach((item, i) => {
      const b = s.ownerDoc.createElement("button");
      b.type = "button";
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", i === idx ? "true" : "false");
      b.textContent = item.label;
      if (i === idx) b.classList.add("is-active");
      b.onmousedown = (ev) => ev.preventDefault();
      b.onclick = () => { item.run(); hide(); };
      list.appendChild(b);
    });
  }

  function open(): void {
    if (panel) { hide(); return; }
    hide();
    panel = s.ownerDoc.createElement("div");
    panel.className = "pde-palette";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Command palette");
    panel.innerHTML = `<input data-q type="search" aria-label="Filter commands" placeholder="Type a command…" />
      <div data-list role="listbox"></div>`;
    s.wrapper.appendChild(panel);
    const input = panel.querySelector("[data-q]") as HTMLInputElement;
    renderList("");
    input.oninput = () => { idx = 0; renderList(input.value); };
    input.onkeydown = (e: KeyboardEvent) => {
      const rows = filtered(input.value);
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); hide(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(idx + 1, rows.length - 1); renderList(input.value); }
      if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(idx - 1, 0); renderList(input.value); }
      if (e.key === "Enter") { e.preventDefault(); rows[idx]?.run(); hide(); }
    };
    ignoreOutside = true;
    s.ownerDoc.defaultView?.setTimeout(() => { ignoreOutside = false; }, 0);
    input.focus();
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (e.key === "Escape" && panel) {
      e.preventDefault();
      hide();
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest?.("input, textarea, select")) {
      if (!((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey))) return;
    }
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      open();
      return;
    }
    if (panel) return;
    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && s.container.contains(target)) {
      const block = s.currentBlockEl();
      if (!block || block.tagName !== "P") return;
      const text = (block.textContent ?? "").replace(/\u00a0/g, " ").trim();
      if (text && text !== "/") return;
      e.preventDefault();
      if (text === "/") block.textContent = "";
      open();
    }
  };

  const onPointer = (e: Event): void => {
    if (!panel || ignoreOutside) return;
    const t = e.target as Node | null;
    if (t && panel.contains(t)) return;
    hide();
  };

  s.ownerDoc.addEventListener("keydown", onKey);
  s.ownerDoc.addEventListener("pointerdown", onPointer, true);

  return {
    open,
    destroy() {
      hide();
      s.ownerDoc.removeEventListener("keydown", onKey);
      s.ownerDoc.removeEventListener("pointerdown", onPointer, true);
    },
  };
}
