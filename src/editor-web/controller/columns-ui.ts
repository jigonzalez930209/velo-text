import { getIconSvg } from "../../assets/icons/index.js";
import { normalizeDocument } from "../../core/normalize/normalize.js";
import type { ColumnsNode } from "../../core/model/types.js";
import type { EditorState, InsertBlockType } from "./types.js";
import { COLUMN_PRESETS } from "./column-presets.js";
import { applyWidths, commitInsert, MAX_LAYOUT_DEPTH, layoutDepthOf } from "./nesting.js";
import { makeBlock } from "./commands.js";
import { wrapperRel } from "./table-resize.js";
import { bindColumnResize, findColumnsNode, showColumnGutters } from "./column-resize.js";

export function attachColumnsUi(s: EditorState): { hideColumnsUi: () => void } {
  let menuEl: HTMLElement | null = null;
  let btnEl: HTMLButtonElement | null = null;
  let gutterEl: HTMLElement | null = null;
  function hideMenu(): void { menuEl?.remove(); menuEl = null; }
  function hideBtn(): void { btnEl?.remove(); btnEl = null; }
  function hideGutters(): void { gutterEl?.remove(); gutterEl = null; }
  function hideColumnsUi(): void { hideMenu(); hideBtn(); hideGutters(); }

  function applyPreset(layout: ColumnsNode, pcts: number[]): void {
    s.pushSnapshot();
    applyWidths(layout, pcts, s.idGen);
    s.setDoc(normalizeDocument(s.getDoc()));
    s.render();
    s.opts.onChange?.(s.getDoc());
  }

  function showMenu(layoutEl: HTMLElement, x: number, y: number): void {
    hideMenu();
    const id = layoutEl.getAttribute("data-node-id") ?? "";
    const layout = findColumnsNode(s, id);
    if (!layout) return;
    menuEl = s.ownerDoc.createElement("div");
    menuEl.className = "pde-block-menu pde-columns-menu";
    menuEl.style.left = `${x}px`;
    menuEl.style.top = `${y}px`;
    const title = s.ownerDoc.createElement("div");
    title.className = "pde-menu-title";
    title.textContent = "Column widths";
    menuEl.appendChild(title);
    for (const preset of COLUMN_PRESETS) {
      const b = s.ownerDoc.createElement("button");
      b.type = "button";
      b.innerHTML = `<span class="pde-preset-bars">${preset.pcts.map((p) => `<i style="flex:${p}"></i>`).join("")}</span><span>${preset.label}</span>`;
      b.onclick = () => { applyPreset(layout, preset.pcts); hideMenu(); };
      menuEl.appendChild(b);
    }
    const insertTitle = s.ownerDoc.createElement("div");
    insertTitle.className = "pde-menu-title";
    insertTitle.textContent = "Insert in focused slot";
    menuEl.appendChild(insertTitle);
    const depth = layoutDepthOf(s.getDoc(), layout.id);
    const kinds: InsertBlockType[] = ["paragraph", "table", "columns"];
    for (const type of kinds) {
      if ((type === "table" || type === "columns") && depth >= MAX_LAYOUT_DEPTH) continue;
      const b = s.ownerDoc.createElement("button");
      b.type = "button";
      b.textContent = type === "paragraph" ? "Paragraph" : type === "table" ? "Table" : "Nested columns";
      b.onclick = () => { commitInsert(s, makeBlock(s, type)); hideMenu(); };
      menuEl.appendChild(b);
    }
    s.ui.append(menuEl);
  }

  function showChrome(layoutEl: HTMLElement): void {
    hideBtn();
    hideGutters();
    gutterEl = showColumnGutters(s, layoutEl);
    const t = wrapperRel(s, layoutEl);
    btnEl = s.ownerDoc.createElement("button");
    btnEl.type = "button";
    btnEl.className = "pde-columns-btn";
    btnEl.title = "Column layout";
    btnEl.innerHTML = getIconSvg("columns3", { size: 14 });
    btnEl.style.left = `${t.left + t.width + 6}px`;
    btnEl.style.top = `${t.top}px`;
    btnEl.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      showMenu(layoutEl, t.left + t.width + 6, t.top + 28);
    };
    s.ui.append(btnEl);
  }

  s.addBoth("click", ((e: MouseEvent) => {
    const el = e.target as HTMLElement | null;
    if (el?.closest?.(".pde-gutter-handle")) return;
    const layout = el?.closest?.(".pde-columns") as HTMLElement | null;
    if (!layout || !s.container.contains(layout)) { hideColumnsUi(); return; }
    showChrome(layout);
  }) as never);

  const prevRender = s.render;
  s.render = () => {
    prevRender();
    for (const layout of Array.from(s.container.querySelectorAll(".pde-columns")) as HTMLElement[]) {
      layout.addEventListener("click", (ev) => {
        if ((ev.target as HTMLElement).closest?.(".pde-columns-btn, .pde-columns-menu")) return;
        showChrome(layout);
      });
    }
  };

  bindColumnResize(s);

  return { hideColumnsUi };
}
