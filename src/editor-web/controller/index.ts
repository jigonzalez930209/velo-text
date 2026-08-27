/**
 * Editor controller — wires contenteditable DOM to the canonical AST.
 */
import type { PortableDocument } from "../../core/model/types.js";
import type { ThemeName } from "../../theme/index.js";
import { themes } from "../../theme/index.js";
import { createIdGenerator, createSystemClock } from "../../core/model/factories.js";
import { normalizeDocument } from "../../core/normalize/normalize.js";
import { renderBlocksToHtml } from "../view/index.js";
import { domToAst } from "../view/parse.js";
import { MAX_HISTORY, COALESCE_MS, BLOCK_SEL, type Editor, type EditorOptions, type EditorState } from "./types.js";
import { bindCommands } from "./commands.js";
import { attachBlockHandles } from "./handles.js";
import { attachImageResize } from "./image-resize.js";
import { attachTableUi } from "./table-ui.js";
import { attachColumnsUi } from "./columns-ui.js";

export type { Editor, EditorOptions, InsertBlockType } from "./types.js";

export function createEditor(container: HTMLElement, opts: EditorOptions): Editor {
  let doc = normalizeDocument(opts.document);
  let theme: ThemeName = opts.theme ?? "light-neutral";
  const idGen = opts.idGenerator ?? createIdGenerator("ed");
  const clock = opts.clock ?? createSystemClock();
  void clock;
  const undoStack: PortableDocument[] = [];
  const redoStack: PortableDocument[] = [];
  const cleanup: Array<() => void> = [];
  const ownerDoc = container.ownerDocument;

  container.classList.add("pde-editor");
  container.setAttribute("contenteditable", opts.editable === false ? "false" : "true");
  const wrapper = ownerDoc.createElement("div");
  wrapper.className = "pde-editor-wrapper";
  wrapper.style.cssText = "position:relative;";
  if (container.parentNode) container.parentNode.insertBefore(wrapper, container);
  else ownerDoc.body.appendChild(wrapper);
  wrapper.appendChild(container);
  const ui = ownerDoc.createElement("div");
  ui.className = "pde-ui-layer";
  ui.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:100;";
  wrapper.appendChild(ui);

  const s = {
    container, wrapper, ui, ownerDoc, opts, idGen, cleanup,
    undoStack, redoStack, lastChangeTime: 0, suppress: false, destroyed: false, theme,
    getDoc: () => doc,
    setDoc: (d: PortableDocument) => { doc = d; },
    render: () => { /* filled below */ },
    pushSnapshot: () => { /* filled below */ },
    syncFromDom: (_c?: boolean) => { /* filled below */ },
    addBoth: (type: string, fn: (e: Event) => void) => {
      container.addEventListener(type, fn);
      ui.addEventListener(type, fn);
      cleanup.push(() => { container.removeEventListener(type, fn); ui.removeEventListener(type, fn); });
    },
    selection: () => ownerDoc.getSelection?.() ?? null,
    currentBlockEl: (): HTMLElement | null => {
      const anchor = s.selection()?.anchorNode as Node | null;
      const el = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as HTMLElement | null);
      const block = el?.closest?.(BLOCK_SEL) as HTMLElement | null;
      return block && container.contains(block) ? block : null;
    },
    blockElements: () => Array.from(container.children) as HTMLElement[],
    indexOfBlockEl: (el: HTMLElement) => s.blockElements().indexOf(el),
    blockIdOf: (el: HTMLElement) => el.getAttribute("data-node-id") ?? "",
  } as EditorState;

  function applyTheme(t: ThemeName): void {
    s.theme = theme = t;
    const tokens = themes[t];
    for (const host of [wrapper, container, ownerDoc.documentElement, ownerDoc.body].filter(Boolean) as HTMLElement[]) {
      host.setAttribute("data-pde-theme", t);
      if (tokens) for (const [k, v] of Object.entries(tokens)) host.style.setProperty(k, v);
    }
  }
  applyTheme(theme);

  s.pushSnapshot = () => {
    undoStack.push(JSON.parse(JSON.stringify(doc)));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
    s.lastChangeTime = Date.now();
  };

  s.render = () => {
    if (s.destroyed) return;
    s.suppress = true;
    container.innerHTML = renderBlocksToHtml(doc);
    const resolve = opts.resolveAssetUrl;
    if (resolve) {
      for (const img of Array.from(container.querySelectorAll("img[data-asset-id]"))) {
        const url = resolve(img.getAttribute("data-asset-id") ?? "");
        if (url) (img as HTMLImageElement).src = url;
      }
    }
    s.suppress = false;
  };

  s.syncFromDom = (allowCoalesce = false) => {
    if (s.suppress) return;
    let next: PortableDocument;
    try { next = normalizeDocument(domToAst(container, doc, idGen)); } catch { return; }
    if (JSON.stringify(next) === JSON.stringify(doc)) return;
    const now = Date.now();
    if (allowCoalesce && now - s.lastChangeTime < COALESCE_MS && undoStack.length) {
      undoStack[undoStack.length - 1] = JSON.parse(JSON.stringify(doc));
    } else {
      undoStack.push(JSON.parse(JSON.stringify(doc)));
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
    }
    s.lastChangeTime = now;
    redoStack.length = 0;
    doc = next;
    opts.onChange?.(doc);
  };

  const onInput = (): void => s.syncFromDom(true);
  container.addEventListener("input", onInput);
  cleanup.push(() => container.removeEventListener("input", onInput));

  const onKeyDown = (e: KeyboardEvent): void => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
  };
  container.addEventListener("keydown", onKeyDown);
  cleanup.push(() => container.removeEventListener("keydown", onKeyDown));

  function undo(): void {
    const prev = undoStack.pop();
    if (!prev) return;
    redoStack.push(JSON.parse(JSON.stringify(doc)));
    doc = prev; s.render(); opts.onChange?.(doc);
  }
  function redo(): void {
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push(JSON.parse(JSON.stringify(doc)));
    doc = next; s.render(); opts.onChange?.(doc);
  }

  const cmds = bindCommands(s);
  const handles = attachBlockHandles(s, cmds);
  const imgUi = attachImageResize(s);
  const tableUi = attachTableUi(s);
  const columnsUi = attachColumnsUi(s);
  s.render();

  return {
    getDocument() { s.syncFromDom(); return doc; },
    setDocument(next) { doc = normalizeDocument(next); s.render(); opts.onChange?.(doc); },
    setTheme: applyTheme,
    getTheme: () => theme,
    undo, redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    commands: {
      toggleMark: cmds.toggleMark,
      setHeading: cmds.setHeading,
      toggleList: cmds.toggleList,
      toggleQuote: cmds.toggleQuote,
      setAlign: cmds.setAlign,
      clearFormat: cmds.clearFormat,
      insertVariable: cmds.insertVariable,
      insertEquation: cmds.insertEquation,
      insertImage: cmds.insertImage,
      insertTable: cmds.insertTable,
      insertColumns: cmds.insertColumns,
      insertBlock: cmds.insertBlock,
      deleteCurrentBlock: cmds.deleteCurrentBlock,
    },
    destroy() {
      s.destroyed = true;
      cleanup.forEach((fn) => fn());
      handles.hideHandle();
      imgUi.hideImgResize();
      tableUi.hideTableUi();
      columnsUi.hideColumnsUi();
      handles.hideDropLine();
      wrapper.remove();
    },
  };
}
