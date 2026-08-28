import { latexToHtml } from "../../core/equation/index.js";
import type { EditorState } from "../controller/types.js";
import type { bindCommands } from "../controller/commands.js";
import { EQ_CATEGORIES } from "./equation-palette.js";

export function attachEquationEditor(
  s: EditorState,
  cmds: ReturnType<typeof bindCommands>,
): { open: (opts?: { latex?: string; display?: boolean; node?: HTMLElement }) => void; destroy: () => void } {
  let panel: HTMLElement | null = null;
  let cat = 0;
  let mode: "preview" | "latex" = "preview";
  let editing: HTMLElement | null = null;

  function hide(): void { panel?.remove(); panel = null; }

  function ta(): HTMLTextAreaElement | null {
    return panel?.querySelector("[data-src]") as HTMLTextAreaElement | null;
  }

  function insertAt(src: string, snippet: string): string {
    const el = ta();
    if (!el) return src + snippet;
    const start = el.selectionStart ?? src.length;
    const end = el.selectionEnd ?? src.length;
    return src.slice(0, start) + snippet + src.slice(end);
  }

  function paint(): void {
    if (!panel) return;
    const src = ta()?.value ?? "";
    const preview = panel.querySelector("[data-preview]") as HTMLElement;
    preview.innerHTML = src.trim()
      ? `<span class="pde-equation pde-equation--block">${latexToHtml(src)}</span>`
      : `<p class="pde-eq-hint">Click the blocks above to build your formula. Switch to LaTeX mode to edit directly.</p>`;
    panel.querySelector("[data-pane-preview]")?.classList.toggle("is-on", mode === "preview");
    panel.querySelector("[data-pane-latex]")?.classList.toggle("is-on", mode === "latex");
    panel.querySelector("[data-tab-preview]")?.setAttribute("aria-selected", String(mode === "preview"));
    panel.querySelector("[data-tab-latex]")?.setAttribute("aria-selected", String(mode === "latex"));
    const row = panel.querySelector("[data-snips]") as HTMLElement;
    row.innerHTML = "";
    for (const item of EQ_CATEGORIES[cat]!.items) {
      const b = s.ownerDoc.createElement("button");
      b.type = "button";
      b.className = "pde-eq-snip";
      b.textContent = item.label;
      b.title = item.latex;
      b.onclick = () => {
        const el = ta()!;
        el.value = insertAt(el.value, item.latex);
        el.focus();
        paint();
      };
      row.appendChild(b);
    }
    panel.querySelectorAll("[data-cat]").forEach((el, i) => el.classList.toggle("is-on", i === cat));
  }

  function commit(): void {
    const latex = (ta()?.value ?? "").trim();
    if (!latex) { hide(); return; }
    const display = (panel?.querySelector("[data-display]") as HTMLInputElement | null)?.checked;
    if (editing && s.container.contains(editing)) {
      editing.setAttribute("data-latex", latex);
      editing.innerHTML = latexToHtml(latex);
      s.syncFromDom(false);
    } else cmds.insertEquation(latex, display);
    hide();
  }

  function open(opts?: { latex?: string; display?: boolean; node?: HTMLElement }): void {
    hide();
    cat = 0;
    mode = "preview";
    editing = opts?.node ?? null;
    panel = s.ownerDoc.createElement("div");
    panel.className = "pde-eq-editor";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Equation editor");
    const cats = EQ_CATEGORIES.map((c, i) => `<button type="button" data-cat="${i}">${c.title}</button>`).join("");
    panel.innerHTML = `<div class="pde-eq-cats">${cats}</div>
      <div class="pde-eq-snips" data-snips></div>
      <div class="pde-eq-tabs">
        <button type="button" data-tab-preview aria-selected="true">Preview</button>
        <button type="button" data-tab-latex aria-selected="false">LaTeX</button>
      </div>
      <div class="pde-eq-pane is-on" data-pane-preview><div data-preview class="pde-eq-preview"></div></div>
      <div class="pde-eq-pane" data-pane-latex><textarea data-src spellcheck="false" aria-label="LaTeX"></textarea></div>
      <div class="pde-eq-foot">
        <label><input type="checkbox" data-display /> Block</label>
        <span class="pde-eq-keys"><kbd>Esc</kbd> exit · <kbd>Ctrl+Enter</kbd> insert</span>
        <button type="button" data-insert>Insert</button>
      </div>`;
    s.wrapper.appendChild(panel);
    const src = ta()!;
    src.value = opts?.latex ?? "";
    if (opts?.display) (panel.querySelector("[data-display]") as HTMLInputElement).checked = true;
    panel.querySelectorAll("[data-cat]").forEach((btn, i) => {
      (btn as HTMLButtonElement).onclick = () => { cat = i; paint(); };
    });
    (panel.querySelector("[data-tab-preview]") as HTMLButtonElement).onclick = () => { mode = "preview"; paint(); };
    (panel.querySelector("[data-tab-latex]") as HTMLButtonElement).onclick = () => { mode = "latex"; paint(); src.focus(); };
    (panel.querySelector("[data-insert]") as HTMLButtonElement).onclick = () => commit();
    src.oninput = () => paint();
    panel.onkeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); hide(); }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commit(); }
    };
    paint();
    src.focus();
  }

  const onDbl = (e: MouseEvent): void => {
    const el = (e.target as HTMLElement).closest?.("[data-node-type='equation'], [data-node-type='equation-block']") as HTMLElement | null;
    if (!el || !s.container.contains(el)) return;
    e.preventDefault();
    open({ latex: el.getAttribute("data-latex") ?? "", display: el.getAttribute("data-node-type") === "equation-block", node: el });
  };
  s.container.addEventListener("dblclick", onDbl);

  return {
    open,
    destroy() {
      hide();
      s.container.removeEventListener("dblclick", onDbl);
    },
  };
}
