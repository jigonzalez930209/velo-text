import { parseVariableSource } from "../../template/parser/parser.js";
import { formatValue, safeResolve } from "../../template/resolver/format.js";
import type { EditorState } from "./types.js";
import { clampToWrapper } from "./table-resize.js";

export function attachVariableUi(s: EditorState): { hideVariableUi: () => void } {
  let pop: HTMLElement | null = null;
  function hideVariableUi(): void { pop?.remove(); pop = null; }

  function catalog(): string[] {
    const fromFn = s.opts.getVariableCatalog?.() ?? [];
    const schema = Object.keys(s.getDoc().variableSchema ?? {});
    return [...new Set([...fromFn, ...schema])];
  }

  function show(span: HTMLElement): void {
    hideVariableUi();
    const r = span.getBoundingClientRect();
    const w = s.wrapper.getBoundingClientRect();
    pop = s.ownerDoc.createElement("div");
    pop.className = "pde-block-menu pde-var-popover";
    pop.style.left = `${r.left - w.left}px`;
    pop.style.top = `${r.bottom - w.top + 4}px`;
    const path = span.getAttribute("data-path") ?? "";
    const format = span.getAttribute("data-format") ?? "";
    const fallback = span.getAttribute("data-fallback") ?? "";
    const opts = catalog().map((p) => `<option value="${esc(p)}">`).join("");
    const data = s.opts.getTemplateData?.() ?? {};
    const resolved = safeResolve(data, path);
    const preview = resolved.found ? formatValue(resolved.value, format || undefined) : "(unresolved)";
    pop.innerHTML = `<label>Path<input data-f="path" list="pde-var-cat" value="${esc(path)}"></label>
      <datalist id="pde-var-cat">${opts}</datalist>
      <label>Format<input data-f="format" value="${esc(format)}" placeholder="currency:ARS"></label>
      <label>Fallback<input data-f="fallback" value="${esc(fallback)}"></label>
      <p data-preview class="pde-var-preview">${esc(preview)}</p>
      <button type="button" data-apply>Apply</button>`;
    pop.querySelector("[data-apply]")?.addEventListener("click", () => {
      const p = (pop!.querySelector('[data-f="path"]') as HTMLInputElement).value.trim();
      const f = (pop!.querySelector('[data-f="format"]') as HTMLInputElement).value.trim();
      const fb = (pop!.querySelector('[data-f="fallback"]') as HTMLInputElement).value.trim();
      if (!p) return;
      const source = `{{${p}${f ? ` | ${f}` : ""}${fb ? ` ?? "${fb}"` : ""}}}`;
      const parsed = parseVariableSource(source);
      if (!parsed.ok) return;
      span.setAttribute("data-path", p);
      span.setAttribute("data-source", source);
      if (f) span.setAttribute("data-format", f); else span.removeAttribute("data-format");
      if (fb) span.setAttribute("data-fallback", fb); else span.removeAttribute("data-fallback");
      span.textContent = source;
      s.syncFromDom(false);
      hideVariableUi();
    });
    s.ui.append(pop);
    clampToWrapper(s, pop);
  }

  s.addBoth("click", ((e: MouseEvent) => {
    const el = e.target as HTMLElement | null;
    const span = el?.closest?.('[data-node-type="variable"]') as HTMLElement | null;
    if (!span || !s.container.contains(span)) { hideVariableUi(); return; }
    e.preventDefault();
    show(span);
  }) as never);

  return { hideVariableUi };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
