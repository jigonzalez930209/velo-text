import type { bindCommands } from "../controller/commands.js";
import type { EditorState } from "../controller/types.js";

export function attachLinkUi(s: EditorState, cmds: ReturnType<typeof bindCommands>): { destroy: () => void } {
  let pop: HTMLElement | null = null;
  function hide(): void { pop?.remove(); pop = null; }

  s.addBoth("click", ((e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest?.("a") as HTMLAnchorElement | null;
    if (!a || !s.container.contains(a)) { hide(); return; }
    e.preventDefault();
    hide();
    const r = a.getBoundingClientRect();
    const w = s.wrapper.getBoundingClientRect();
    pop = s.ownerDoc.createElement("div");
    pop.className = "pde-link-pop";
    pop.innerHTML = `<input data-href aria-label="URL" value="${esc(a.getAttribute("href") ?? "")}" />
      <button type="button" data-ok>Save</button>
      <button type="button" data-off>Unlink</button>`;
    pop.style.left = `${r.left - w.left}px`;
    pop.style.top = `${r.bottom - w.top + 4}px`;
    pop.querySelector("[data-ok]")!.addEventListener("click", () => {
      const href = (pop!.querySelector("[data-href]") as HTMLInputElement).value.trim();
      if (!/^https?:|^mailto:|^#/i.test(href)) return;
      a.setAttribute("href", href);
      s.syncFromDom(false);
      hide();
    });
    pop.querySelector("[data-off]")!.addEventListener("click", () => {
      cmds.clearFormat();
      try { s.ownerDoc.execCommand("unlink"); } catch { /* ignore */ }
      s.syncFromDom(false);
      hide();
    });
    s.wrapper.appendChild(pop);
  }) as never);

  const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") hide(); };
  s.container.addEventListener("keydown", onKey);
  return { destroy() { hide(); s.container.removeEventListener("keydown", onKey); } };
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
