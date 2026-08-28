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
import { History } from "../../core/history/history.js";
import { MAX_HISTORY, BLOCK_SEL, type Editor, type EditorOptions, type EditorState } from "./types.js";
import { bindCommands } from "./commands.js";
import { attachBlockHandles } from "./handles.js";
import { attachImageResize } from "./image-resize.js";
import { attachTableUi } from "./table-ui.js";
import { attachColumnsUi } from "./columns-ui.js";
import { attachVariableUi } from "./variable-ui.js";
import { attachEditing, composingOf } from "./host.js";
import { attachHostUx } from "../ux/attach.js";

export type { Editor, EditorOptions, InsertBlockType } from "./types.js";
export { openSizePicker, openMosaicPicker, clampTableSize } from "./size-picker.js";
export { placeOverlay } from "./place-overlay.js";

export function createEditor(container: HTMLElement, opts: EditorOptions): Editor {
  let doc = normalizeDocument(opts.document);
  let theme: ThemeName = opts.theme ?? "light-neutral";
  const idGen = opts.idGenerator ?? createIdGenerator("ed");
  const clock = opts.clock ?? createSystemClock();
  void clock;
  const history = new History(MAX_HISTORY);
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
  ui.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:1;";
  wrapper.appendChild(ui);

  const s = {
    container, wrapper, ui, ownerDoc, opts, idGen, cleanup,
    lastChangeTime: 0, suppress: false, destroyed: false, theme,
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
    history.push({ document: JSON.parse(JSON.stringify(doc)), inverses: [], ops: [], intent: "edit", time: Date.now() });
    history.checkpoint();
    s.lastChangeTime = Date.now();
  };

  s.render = () => {
    if (s.destroyed) return;
    s.suppress = true;
    container.innerHTML = renderBlocksToHtml(doc, opts.resolveAssetUrl);
    s.suppress = false;
  };

  s.syncFromDom = (allowCoalesce = false) => {
    if (s.suppress || composingOf(container)) return;
    let next: PortableDocument;
    try { next = normalizeDocument(domToAst(container, doc, idGen)); } catch { return; }
    if (JSON.stringify(next) === JSON.stringify(doc)) return;
    history.push({
      document: JSON.parse(JSON.stringify(doc)),
      inverses: [],
      ops: [],
      intent: allowCoalesce ? "typing" : "edit",
      time: Date.now(),
    });
    s.lastChangeTime = Date.now();
    doc = next;
    opts.onChange?.(doc);
  };

  const onInput = (): void => s.syncFromDom(true);
  container.addEventListener("input", onInput);
  cleanup.push(() => container.removeEventListener("input", onInput));

  function undo(): void {
    const prev = history.undo(JSON.parse(JSON.stringify(doc)));
    if (!prev) return;
    doc = prev; s.render(); opts.onChange?.(doc);
  }
  function redo(): void {
    const next = history.redo(JSON.parse(JSON.stringify(doc)));
    if (!next) return;
    doc = next; s.render(); opts.onChange?.(doc);
  }

  const cmds = bindCommands(s);
  cleanup.push(attachEditing(s, cmds, { undo, redo }));
  const handles = attachBlockHandles(s, cmds);
  const imgUi = attachImageResize(s);
  const tableUi = attachTableUi(s);
  const columnsUi = attachColumnsUi(s);
  const varUi = attachVariableUi(s);
  const ux = attachHostUx(s, cmds, { undo, redo });
  s.render();

  return {
    getDocument() { s.syncFromDom(); return doc; },
    setDocument(next) { doc = normalizeDocument(next); s.render(); opts.onChange?.(doc); },
    setTheme: applyTheme,
    getTheme: () => theme,
    undo, redo,
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
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
      insertColumnMosaic: cmds.insertColumnMosaic,
      insertBlock: cmds.insertBlock,
      deleteCurrentBlock: cmds.deleteCurrentBlock,
      setColor: cmds.setColor,
      setHighlight: cmds.setHighlight,
      setFontFamily: cmds.setFontFamily,
      setFontSizePt: cmds.setFontSizePt,
      indent: cmds.indent,
      insertLink: cmds.insertLink,
    },
    openCommandPalette: ux.openCommandPalette,
    openFind: ux.openFind,
    openShortcuts: ux.openShortcuts,
    openEquationEditor: ux.openEquationEditor,
    setPagePreview: ux.setPagePreview,
    getOutline: ux.getOutline,
    focusBlock: ux.focusBlock,
    destroy() {
      s.destroyed = true;
      cleanup.forEach((fn) => fn());
      ux.destroy();
      handles.hideHandle();
      imgUi.hideImgResize();
      tableUi.hideTableUi();
      columnsUi.hideColumnsUi();
      varUi.hideVariableUi();
      handles.hideDropLine();
      wrapper.remove();
    },
  };
}
