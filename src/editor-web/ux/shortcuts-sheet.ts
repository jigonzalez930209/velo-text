import type { EditorState } from "../controller/types.js";

const ROWS = [
  ["Mod+K", "Command palette"],
  ["/", "Slash menu (empty paragraph)"],
  ["Mod+F / Mod+H", "Find / replace"],
  ["Mod+B / I / U", "Bold / italic / underline"],
  ["Mod+Z / Mod+Y", "Undo / redo"],
  ["?", "This shortcut list"],
  ["Esc", "Close overlays"],
];

export function attachShortcutSheet(s: EditorState): { open: () => void; destroy: () => void } {
  let sheet: HTMLElement | null = null;
  function destroy(): void { sheet?.remove(); sheet = null; }

  function open(): void {
    destroy();
    sheet = s.ownerDoc.createElement("div");
    sheet.className = "pde-keys";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-label", "Keyboard shortcuts");
    const table = s.ownerDoc.createElement("table");
    for (const [k, v] of ROWS) {
      const tr = s.ownerDoc.createElement("tr");
      const td1 = s.ownerDoc.createElement("th");
      const td2 = s.ownerDoc.createElement("td");
      td1.textContent = k;
      td2.textContent = v;
      tr.append(td1, td2);
      table.appendChild(tr);
    }
    const close = s.ownerDoc.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.onclick = () => destroy();
    sheet.append(table, close);
    s.wrapper.appendChild(sheet);
  }

  const onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement;
    if (t.closest?.("input, textarea")) return;
    if (e.key === "?" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); open(); }
    if (e.key === "Escape") destroy();
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
