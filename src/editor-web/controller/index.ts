/**
 * Editor controller — Phase 4 complete
 * Wires contenteditable DOM to the canonical AST with two-way sync:
 *  - typing/paste/delete mutate the DOM (browser-native), then domToAst syncs the AST
 *  - commands (marks/headings/lists/align/blocks) and undo/redo mutate the AST and re-render
 * Features: snapshot undo/redo with typing coalescing, live themes, Lexical-like block
 * handles with drag & drop reorder + insert menu, image resize, table column/row resize
 * with an interactive menu. Zero dependencies.
 */
import type { PortableDocument, BlockNode, InlineNode, TextMarks, IdGenerator, Clock } from "../../core/model/types.js";
import type { ThemeName } from "../../theme/index.js";
import { createIdGenerator, createSystemClock, createText, createVariable, createEquation, createImageBlock, createTable, createParagraph, createHeading } from "../../core/model/factories.js";
import { normalizeDocument } from "../../core/normalize/normalize.js";
import { renderDocumentToHtml, logicalToDomSelection } from "../view/index.js";
import { domToAst } from "../view/parse.js";
import { getIconSvg, type IconName } from "../../assets/icons/index.js";
import { pxToUm, umToPx } from "../../export/layout/units.js";

export interface EditorOptions {
  document: PortableDocument;
  theme?: ThemeName;
  editable?: boolean;
  idGenerator?: IdGenerator;
  clock?: Clock;
  onChange?: (doc: PortableDocument) => void;
}

export type InsertBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "quote"
  | "listUnordered"
  | "listOrdered"
  | "table"
  | "equationBlock"
  | "pageBreak"
  | "horizontalRule";

export interface Editor {
  getDocument(): PortableDocument;
  setDocument(doc: PortableDocument): void;
  setTheme(theme: ThemeName): void;
  getTheme(): ThemeName;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  commands: {
    toggleMark(mark: keyof TextMarks & string): void;
    setHeading(level: number | null): void;
    toggleList(kind: "ordered" | "unordered"): void;
    toggleQuote(): void;
    setAlign(align: "left" | "center" | "right" | "justify"): void;
    clearFormat(): void;
    insertVariable(path: string, format?: string, fallback?: string): void;
    insertEquation(latex: string, display?: boolean): void;
    insertImage(assetId: string, widthUm?: number, heightUm?: number): void;
    insertTable(rows: number, cols: number): void;
    insertBlock(type: InsertBlockType): void;
    deleteCurrentBlock(): void;
  };
  destroy(): void;
}

const MAX_HISTORY = 100;
const COALESCE_MS = 800;

export function createEditor(container: HTMLElement, opts: EditorOptions): Editor {
  let doc = normalizeDocument(opts.document);
  let theme: ThemeName = opts.theme ?? "light-neutral";
  const idGen = opts.idGenerator ?? createIdGenerator("ed");
  const clock = opts.clock ?? createSystemClock();
  const undoStack: PortableDocument[] = [];
  const redoStack: PortableDocument[] = [];
  let lastChangeTime = 0;
  let suppress = false;
  let destroyed = false;
  const cleanup: Array<() => void> = [];
  const ownerDoc = container.ownerDocument;

  container.classList.add("pde-editor");
  container.setAttribute("data-pde-theme", theme);

  // ── render ──
  function render(): void {
    if (destroyed) return;
    suppress = true;
    container.innerHTML = renderDocumentToHtml(doc, { theme, editable: opts.editable !== false }).replace(/^<div[^>]*>/, "").replace(/<\/div>$/, "");
    suppress = false;
  }

  function pushSnapshot(): void {
    undoStack.push(JSON.parse(JSON.stringify(doc)));
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
    lastChangeTime = Date.now();
  }

  function syncFromDom(allowCoalesce = false): void {
    if (suppress) return;
    let next: PortableDocument;
    try {
      next = domToAst(container, doc, idGen);
      next = normalizeDocument(next);
    } catch {
      return;
    }
    if (JSON.stringify(next) === JSON.stringify(doc)) return;
    const now = Date.now();
    if (allowCoalesce && now - lastChangeTime < COALESCE_MS && undoStack.length) {
      undoStack[undoStack.length - 1] = JSON.parse(JSON.stringify(doc));
    } else {
      undoStack.push(JSON.parse(JSON.stringify(doc)));
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
    }
    lastChangeTime = now;
    redoStack.length = 0;
    doc = next;
    opts.onChange?.(doc);
  }

  // ── input events: browser mutates DOM, we sync AST ──
  const onInput = (): void => syncFromDom(true);
  container.addEventListener("input", onInput);
  cleanup.push(() => container.removeEventListener("input", onInput));

  const onKeyDown = (e: KeyboardEvent): void => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && (e.key.toLowerCase() === "y")) {
      e.preventDefault();
      redo();
    }
  };
  container.addEventListener("keydown", onKeyDown);
  cleanup.push(() => container.removeEventListener("keydown", onKeyDown));

  // ── history ──
  function undo(): void {
    const prev = undoStack.pop();
    if (!prev) return;
    redoStack.push(JSON.parse(JSON.stringify(doc)));
    doc = prev;
    render();
    opts.onChange?.(doc);
  }
  function redo(): void {
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push(JSON.parse(JSON.stringify(doc)));
    doc = next;
    render();
    opts.onChange?.(doc);
  }

  function setDocument(next: PortableDocument): void {
    doc = normalizeDocument(next);
    render();
    opts.onChange?.(doc);
  }

  // ── selection helpers ──
  function selection(): Selection | null {
    return ownerDoc.getSelection?.() ?? null;
  }
  function currentBlockEl(): HTMLElement | null {
    const sel = selection();
    const anchor = sel?.anchorNode as Node | null;
    const el = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as HTMLElement | null);
    const block = el?.closest?.(
      'p, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table, figure, hr, [data-node-type="page-break"], [data-node-type="equation-block"]',
    ) as HTMLElement | null;
    return block && container.contains(block) ? block : null;
  }

  function blockElements(): HTMLElement[] {
    return Array.from(container.children) as HTMLElement[];
  }

  function indexOfBlockEl(el: HTMLElement): number {
    return blockElements().indexOf(el);
  }

  function blockIdOf(el: HTMLElement): string {
    return el.getAttribute("data-node-id") ?? "";
  }

  function exec(cmd: string, value?: string): void {
    try {
      ownerDoc.execCommand(cmd, false, value as never);
    } catch {
      // no-op in unsupported environments
    }
  }

  // ── commands ──
  const MARK_CMDS: Record<string, string> = { bold: "bold", italic: "italic", underline: "underline", strike: "strikeThrough", code: "" };

  function toggleMark(mark: string): void {
    container.focus();
    const cmd = MARK_CMDS[mark];
    if (cmd) exec(cmd);
    else if (mark === "code") wrapSelection("code");
    syncFromDom();
  }

  function wrapSelection(tag: string): void {
    const sel = selection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const el = ownerDoc.createElement(tag);
    try {
      range.surroundContents(el);
    } catch {
      // Partial nodes: wrap each text node separately
      const frag = range.extractContents();
      el.appendChild(frag);
      range.insertNode(el);
    }
    sel.removeAllRanges();
    const r = ownerDoc.createRange();
    r.selectNodeContents(el);
    sel.addRange(r);
  }

  function setHeading(level: number | null): void {
    container.focus();
    exec("formatBlock", level ? `H${level}` : "P");
    syncFromDom();
  }

  function toggleList(kind: "ordered" | "unordered"): void {
    container.focus();
    exec(kind === "ordered" ? "insertOrderedList" : "insertUnorderedList");
    syncFromDom();
  }

  function toggleQuote(): void {
    container.focus();
    exec("formatBlock", "blockquote");
    syncFromDom();
  }

  function setAlign(align: string): void {
    const block = currentBlockEl();
    if (block) {
      (block as HTMLElement).style.textAlign = align;
      syncFromDom();
    }
  }

  function clearFormat(): void {
    container.focus();
    exec("removeFormat");
    syncFromDom();
  }

  function insertInlineAtCaret(el: HTMLElement): void {
    container.focus();
    const sel = selection();
    let range: Range;
    if (sel && sel.rangeCount) {
      range = sel.getRangeAt(0);
      range.collapse(false);
    } else {
      range = ownerDoc.createRange();
      range.selectNodeContents(container);
      range.collapse(false);
    }
    range.insertNode(el);
    range.setStartAfter(el);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    lastChangeTime = 0;
    syncFromDom(false);
  }

  function insertVariable(path: string, format?: string, fallback?: string): void {
    const source = `{{${path}${format ? ` | ${format}` : ""}${fallback ? ` ?? "${fallback}"` : ""}}}`;
    const span = ownerDoc.createElement("span");
    span.setAttribute("data-node-type", "variable");
    span.setAttribute("data-node-id", idGen.next());
    span.setAttribute("data-path", path);
    span.setAttribute("data-source", source);
    span.setAttribute("contenteditable", "false");
    span.setAttribute("role", "button");
    span.className = "pde-variable";
    span.textContent = source;
    insertInlineAtCaret(span);
  }

  function insertEquation(latex: string, display = false): void {
    const span = ownerDoc.createElement("span");
    span.setAttribute("data-node-type", "equation");
    span.setAttribute("data-node-id", idGen.next());
    span.setAttribute("data-latex", latex);
    span.setAttribute("contenteditable", "false");
    span.setAttribute("role", "math");
    span.className = "pde-equation";
    span.textContent = latex;
    insertInlineAtCaret(span);
  }

  function appendBlock(node: BlockNode): void {
    pushSnapshot();
    doc.root.children.push(node);
    doc = normalizeDocument(doc);
    render();
    opts.onChange?.(doc);
  }

  function insertImage(assetId: string, widthUm = 150000, heightUm = 90000): void {
    appendBlock(createImageBlock(idGen, assetId, { alt: "image", widthUm, heightUm }));
  }

  function insertTable(rows = 2, cols = 2): void {
    appendBlock(createTable(idGen, cols, rows));
  }

  function makeBlock(type: InsertBlockType): BlockNode {
    switch (type) {
      case "heading1": return createHeading(idGen, 1, [createText(idGen, "")]);
      case "heading2": return createHeading(idGen, 2, [createText(idGen, "")]);
      case "heading3": return createHeading(idGen, 3, [createText(idGen, "")]);
      case "quote": return { type: "quote", id: idGen.next(), children: [createText(idGen, "")] };
      case "listUnordered": return { type: "list", id: idGen.next(), kind: "unordered", items: [{ id: idGen.next(), content: [createText(idGen, "")] }] };
      case "listOrdered": return { type: "list", id: idGen.next(), kind: "ordered", items: [{ id: idGen.next(), content: [createText(idGen, "")] }] };
      case "table": return createTable(idGen, 2, 2);
      case "equationBlock": return { type: "equation-block", id: idGen.next(), latex: "E = mc^2" };
      case "pageBreak": return { type: "page-break", id: idGen.next() };
      case "horizontalRule": return { type: "horizontal-rule", id: idGen.next() };
      default: return createParagraph(idGen, [createText(idGen, "")]);
    }
  }

  function insertBlockAfter(blockEl: HTMLElement, type: InsertBlockType): void {
    const idx = indexOfBlockEl(blockEl);
    const node = makeBlock(type);
    pushSnapshot();
    doc.root.children.splice(idx + 1, 0, node);
    render();
    opts.onChange?.(doc);
  }

  function deleteCurrentBlock(): void {
    const block = currentBlockEl();
    if (!block) return;
    const idx = indexOfBlockEl(block);
    if (idx === -1) return;
    pushSnapshot();
    doc.root.children.splice(idx, 1);
    if (!doc.root.children.length) doc.root.children.push(createParagraph(idGen, [createText(idGen, "")]));
    render();
    opts.onChange?.(doc);
  }

  // ── block handles + drag & drop + insert menu (Lexical-like) ──
  let handleEl: HTMLElement | null = null;
  let menuEl: HTMLElement | null = null;

  function hideHandle(): void {
    handleEl?.remove();
    handleEl = null;
    hideMenu();
  }
  function hideMenu(): void {
    menuEl?.remove();
    menuEl = null;
  }

  function positionHandle(blockEl: HTMLElement): void {
    hideHandle();
    handleEl = ownerDoc.createElement("div");
    handleEl.className = "pde-block-handle";
    handleEl.dataset.blockHandle = "";
    handleEl.dataset.owner = blockIdOf(blockEl);
    handleEl.style.top = `${Math.min(blockEl.offsetTop, container.clientHeight - 24)}px`;
    const grip = ownerDoc.createElement("span");
    grip.className = "pde-handle-grip";
    grip.dataset.blockHandleGrip = "";
    grip.innerHTML = getIconSvg("gripVertical", { size: 14 });
    grip.title = "Drag to move block";
    const plus = ownerDoc.createElement("span");
    plus.className = "pde-handle-plus";
    plus.dataset.blockHandleMenu = "";
    plus.innerHTML = getIconSvg("plus", { size: 14 });
    plus.title = "Insert block";
    handleEl.append(grip, plus);
    container.append(handleEl);
  }

  const onMouseOver = (e: MouseEvent): void => {
    if (destroyed) return;
    const t = e.target as HTMLElement;
    const blockEl = t.closest?.(
      'p, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table, figure, hr, [data-node-type="page-break"], [data-node-type="equation-block"]',
    ) as HTMLElement | null;
    if (!blockEl || !container.contains(blockEl)) {
      hideHandle();
      return;
    }
    if (handleEl && handleEl.dataset.owner === blockIdOf(blockEl)) return;
    positionHandle(blockEl);
  };
  container.addEventListener("mouseover", onMouseOver);
  cleanup.push(() => container.removeEventListener("mouseover", onMouseOver));

  // Drag reorder
  const onPointerDown = (e: PointerEvent): void => {
    const grip = (e.target as HTMLElement).closest?.("[data-block-handle-grip]") as HTMLElement | null;
    if (!grip || !handleEl) return;
    const owner = handleEl.dataset.owner;
    e.preventDefault();
    const blockEl = blockElements().find((b) => blockIdOf(b) === owner) ?? null;
    if (!blockEl) return;
    const fromIndex = indexOfBlockEl(blockEl);
    let toIndex = fromIndex;
    const onMove = (ev: PointerEvent): void => {
      const els = blockElements();
      let target = fromIndex;
      for (let i = 0; i < els.length; i++) {
        const r = els[i]!.getBoundingClientRect();
        if (ev.clientY > r.top + r.height / 2) target = i;
      }
      toIndex = target;
    };
    const onUp = (): void => {
      ownerDoc.removeEventListener("pointermove", onMove);
      ownerDoc.removeEventListener("pointerup", onUp);
      if (toIndex !== fromIndex && toIndex >= 0 && toIndex < doc.root.children.length) {
        pushSnapshot();
        const arr = doc.root.children;
        const [item] = arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, item!);
        render();
        opts.onChange?.(doc);
      }
    };
    ownerDoc.addEventListener("pointermove", onMove);
    ownerDoc.addEventListener("pointerup", onUp);
  };
  container.addEventListener("pointerdown", onPointerDown);
  cleanup.push(() => container.removeEventListener("pointerdown", onPointerDown));

  // Insert menu
  const MENU_ITEMS: Array<{ label: string; icon: IconName; type: InsertBlockType }> = [
    { label: "Paragraph", icon: "alignLeft", type: "paragraph" },
    { label: "Heading 1", icon: "heading1", type: "heading1" },
    { label: "Heading 2", icon: "heading2", type: "heading2" },
    { label: "Heading 3", icon: "heading3", type: "heading3" },
    { label: "Quote", icon: "quote", type: "quote" },
    { label: "Bulleted list", icon: "listUnordered", type: "listUnordered" },
    { label: "Numbered list", icon: "listOrdered", type: "listOrdered" },
    { label: "Table", icon: "table", type: "table" },
    { label: "Equation", icon: "equation", type: "equationBlock" },
    { label: "Page break", icon: "split", type: "pageBreak" },
    { label: "Horizontal rule", icon: "minus", type: "horizontalRule" },
  ];

  const onPointerDownMenu = (e: PointerEvent): void => {
    const plus = (e.target as HTMLElement).closest?.("[data-block-handle-menu]") as HTMLElement | null;
    if (!plus || !handleEl) return;
    e.preventDefault();
    e.stopPropagation();
    hideMenu();
    menuEl = ownerDoc.createElement("div");
    menuEl.className = "pde-block-menu";
    menuEl.style.top = `${Math.min(handleEl.offsetTop, container.clientHeight - 40)}px`;
    menuEl.style.left = "28px";
    for (const item of MENU_ITEMS) {
      const btn = ownerDoc.createElement("button");
      btn.type = "button";
      btn.innerHTML = `${getIconSvg(item.icon, { size: 16 })}<span>${item.label}</span>`;
      btn.onclick = () => {
        const owner = handleEl?.dataset.owner ?? "";
        const blockEl = blockElements().find((b) => blockIdOf(b) === owner);
        if (blockEl) insertBlockAfter(blockEl, item.type);
        hideMenu();
      };
      menuEl.appendChild(btn);
    }
    container.append(menuEl);
  };
  container.addEventListener("pointerdown", onPointerDownMenu);
  cleanup.push(() => container.removeEventListener("pointerdown", onPointerDownMenu));

  const onBlur = (): void => {
    setTimeout(hideHandle, 200);
  };
  container.addEventListener("blur", onBlur);
  cleanup.push(() => container.removeEventListener("blur", onBlur));

  // ── image resize ──
  let imgResizeEl: HTMLElement | null = null;
  function hideImgResize(): void {
    imgResizeEl?.remove();
    imgResizeEl = null;
  }

  const onImageClick = (e: MouseEvent): void => {
    const t = e.target as HTMLElement;
    const figure = t.closest?.("figure[data-node-type='image']") as HTMLElement | null;
    if (!figure) {
      hideImgResize();
      return;
    }
    e.stopPropagation();
    hideImgResize();
    imgResizeEl = ownerDoc.createElement("div");
    imgResizeEl.className = "pde-image-resize";
    const rect = figure.getBoundingClientRect();
    imgResizeEl.style.left = `${rect.left - container.getBoundingClientRect().left - 4}px`;
    imgResizeEl.style.top = `${rect.top - container.getBoundingClientRect().top - 4}px`;
    imgResizeEl.style.width = `${rect.width + 8}px`;
    imgResizeEl.style.height = `${rect.height + 8}px`;
    for (const pos of ["nw", "se"]) {
      const h = ownerDoc.createElement("span");
      h.className = `pde-img-handle ${pos}`;
      h.dataset.imgHandle = pos;
      imgResizeEl.appendChild(h);
    }
    container.append(imgResizeEl);
  };
  container.addEventListener("click", onImageClick);
  cleanup.push(() => container.removeEventListener("click", onImageClick));

  const onPointerDownImg = (e: PointerEvent): void => {
    const h = (e.target as HTMLElement).closest?.("[data-img-handle]") as HTMLElement | null;
    if (!h || !imgResizeEl) return;
    e.preventDefault();
    const figure = container.querySelector("figure[data-node-type='image']");
    if (!figure) return;
    const id = figure.getAttribute("data-node-id") ?? "";
    const startWUm = Number(figure.getAttribute("data-width-um")) || 150000;
    const startHUm = Number(figure.getAttribute("data-height-um")) || 90000;
    const aspect = startHUm / startWUm;
    const startX = e.clientX;
    pushSnapshot();
    const onMove = (ev: PointerEvent): void => {
      const dxPx = ev.clientX - startX;
      const newWUm = Math.max(20000, startWUm + Math.round(dxPx * (25400 / 96)));
      const newHUm = Math.round(newWUm * aspect);
      const img = figure.querySelector("img");
      if (img) {
        img.style.width = `${Math.round(umToPx(newWUm))}px`;
        img.style.height = `${Math.round(umToPx(newHUm))}px`;
      }
      figure.setAttribute("data-width-um", String(newWUm));
      figure.setAttribute("data-height-um", String(newHUm));
    };
    const onUp = (): void => {
      ownerDoc.removeEventListener("pointermove", onMove);
      ownerDoc.removeEventListener("pointerup", onUp);
      // commit into AST
      const imgNode = doc.root.children.find((b) => b.id === id);
      if (imgNode && imgNode.type === "image") {
        imgNode.widthUm = Number(figure.getAttribute("data-width-um")) || startWUm;
        imgNode.heightUm = Number(figure.getAttribute("data-height-um")) || startHUm;
        opts.onChange?.(doc);
      }
    };
    ownerDoc.addEventListener("pointermove", onMove);
    ownerDoc.addEventListener("pointerup", onUp);
  };
  container.addEventListener("pointerdown", onPointerDownImg);
  cleanup.push(() => container.removeEventListener("pointerdown", onPointerDownImg));

  // ── table resize + menu ──
  let tableMenuEl: HTMLElement | null = null;
  let colResizeEl: HTMLElement | null = null;

  function hideTableUi(): void {
    tableMenuEl?.remove();
    tableMenuEl = null;
    colResizeEl?.remove();
    colResizeEl = null;
  }

  function showTableMenu(table: HTMLTableElement, x: number, y: number): void {
    hideTableUi();
    const found = doc.root.children.find((b) => b.id === table.getAttribute("data-node-id"));
    if (!found || found.type !== "table") return;
    const tblNode = found as unknown as TableLike;
    tableMenuEl = ownerDoc.createElement("div");
    tableMenuEl.className = "pde-block-menu pde-table-menu";
    tableMenuEl.style.left = `${Math.min(x, container.clientWidth - 180)}px`;
    tableMenuEl.style.top = `${y}px`;
    const curRow = currentBlockEl()?.closest("tr") as HTMLElement | null;
    const curCell = currentBlockEl()?.closest("td, th") as HTMLElement | null;
    const rowIndex = curRow ? Array.from(curRow.parentElement!.children).indexOf(curRow) : 0;
    const cellIndex = curCell ? Array.from(curCell.parentElement!.children).indexOf(curCell) : 0;

    const addBtn = (label: string, fn: () => void): void => {
      const b = ownerDoc.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.onclick = () => { fn(); hideTableUi(); };
      tableMenuEl!.appendChild(b);
    };
    addBtn("Insert row above", () => tableOp(() => cloneRow(tblNode, rowIndex, rowIndex)));
    addBtn("Insert row below", () => tableOp(() => cloneRow(tblNode, rowIndex, rowIndex + 1)));
    addBtn("Delete row", () => tableOp(() => deleteRowOp(tblNode, rowIndex)));
    addBtn("Insert column left", () => tableOp(() => insertCol(tblNode, cellIndex)));
    addBtn("Insert column right", () => tableOp(() => insertCol(tblNode, cellIndex + 1)));
    addBtn("Delete column", () => tableOp(() => deleteCol(tblNode, cellIndex)));
    addBtn("Delete table", () => tableOp(() => deleteTable(tblNode)));
    container.append(tableMenuEl);
  }

  function tableOp(mutate: () => void): void {
    pushSnapshot();
    mutate();
    doc = normalizeDocument(doc);
    render();
    opts.onChange?.(doc);
  }
  interface TableLike { id?: string; columns: Array<{ id: string; widthUm: number }>; rows: Array<{ id: string; cells: Array<{ id: string; colSpan: number }> }> }
  const cloneRow = (tblNode: TableLike, srcIdx: number, atIdx: number): void => {
    const src = tblNode.rows[srcIdx];
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src)) as typeof src;
    copy.id = idGen.next();
    for (const c of copy.cells) c.id = idGen.next();
    tblNode.rows.splice(Math.max(0, Math.min(atIdx, tblNode.rows.length)), 0, copy);
  };
  const deleteRowOp = (tblNode: { rows: Array<unknown> }, idx: number): void => {
    if (tblNode.rows.length > 1) tblNode.rows.splice(idx, 1);
  };
  const insertCol = (tblNode: { columns: Array<{ id: string; widthUm: number }>; rows: Array<{ cells: Array<{ id: string; colSpan: number }> }> }, atIdx: number): void => {
    tblNode.columns.splice(Math.max(0, atIdx), 0, { id: idGen.next(), widthUm: 40000 });
    for (const row of tblNode.rows) {
      row.cells.splice(Math.max(0, atIdx), 0, { id: idGen.next(), colSpan: 1, blocks: [{ type: "paragraph", id: idGen.next(), children: [] }] } as never);
    }
  };
  const deleteCol = (tblNode: { columns: Array<unknown>; rows: Array<{ cells: Array<unknown> }> }, idx: number): void => {
    if (tblNode.columns.length > 1) {
      tblNode.columns.splice(idx, 1);
      for (const row of tblNode.rows) row.cells.splice(idx, 1);
    }
  };
  const deleteTable = (tblNode: { id?: string }): void => {
    const idx = doc.root.children.findIndex((b) => b.id === tblNode.id);
    if (idx !== -1) doc.root.children.splice(idx, 1);
  };

  const onTableClick = (e: MouseEvent): void => {
    const t = e.target as HTMLElement;
    const table = t.closest?.("table[data-node-type='table']") as HTMLTableElement | null;
    if (!table) {
      hideTableUi();
      return;
    }
    e.stopPropagation();
    const rect = table.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    showTableMenu(table, rect.right - cRect.left - 180, rect.top - cRect.top);
    showColResize(table);
  };
  container.addEventListener("click", onTableClick);
  cleanup.push(() => container.removeEventListener("click", onTableClick));

  function showColResize(table: HTMLTableElement): void {
    hideColResize();
    colResizeEl = ownerDoc.createElement("div");
    colResizeEl.className = "pde-col-resize";
    const cRect = container.getBoundingClientRect();
    const tRect = table.getBoundingClientRect();
    const cols = table.querySelectorAll("colgroup col");
    let x = 0;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i] as HTMLElement;
      x += col.offsetWidth;
      const h = ownerDoc.createElement("span");
      h.className = "pde-col-handle";
      h.dataset.colIndex = String(i);
      h.style.left = `${tRect.left - cRect.left + x - 3}px`;
      h.style.top = `${tRect.top - cRect.top - 2}px`;
      h.style.height = `${tRect.height + 4}px`;
      colResizeEl.appendChild(h);
    }
    container.append(colResizeEl);
  }
  function hideColResize(): void {
    colResizeEl?.remove();
    colResizeEl = null;
  }

  const onPointerDownCol = (e: PointerEvent): void => {
    const h = (e.target as HTMLElement).closest?.("[data-col-index]") as HTMLElement | null;
    if (!h) return;
    e.preventDefault();
    const colIdx = Number(h.dataset.colIndex);
    const table = container.querySelector("table[data-node-type='table']") as HTMLTableElement | null;
    if (!table) return;
    const tblId = table.getAttribute("data-node-id") ?? "";
    const tblNode = doc.root.children.find((b) => b.id === tblId && b.type === "table");
    if (!tblNode || tblNode.type !== "table") return;
    const col = tblNode.columns[colIdx];
    if (!col) return;
    const startX = e.clientX;
    const startW = col.widthUm;
    pushSnapshot();
    const onMove = (ev: PointerEvent): void => {
      const dxPx = ev.clientX - startX;
      const newWUm = Math.max(10000, startW + Math.round(dxPx * (25400 / 96)));
      col.widthUm = newWUm;
      const colEl = table.querySelectorAll("colgroup col")[colIdx] as HTMLElement | null;
      if (colEl) {
        colEl.style.width = `${Math.round(umToPx(newWUm))}px`;
        colEl.setAttribute("data-col-width-um", String(newWUm));
      }
    };
    const onUp = (): void => {
      ownerDoc.removeEventListener("pointermove", onMove);
      ownerDoc.removeEventListener("pointerup", onUp);
      opts.onChange?.(doc);
    };
    ownerDoc.addEventListener("pointermove", onMove);
    ownerDoc.addEventListener("pointerup", onUp);
  };
  container.addEventListener("pointerdown", onPointerDownCol);
  cleanup.push(() => container.removeEventListener("pointerdown", onPointerDownCol));

  // ── theme ──
  function setTheme(t: ThemeName): void {
    theme = t;
    container.setAttribute("data-pde-theme", t);
  }

  // ── public API ──
  render();

  return {
    getDocument(): PortableDocument {
      syncFromDom();
      return doc;
    },
    setDocument,
    setTheme,
    getTheme: () => theme,
    undo,
    redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    commands: {
      toggleMark,
      setHeading,
      toggleList,
      toggleQuote,
      setAlign,
      clearFormat,
      insertVariable,
      insertEquation,
      insertImage,
      insertTable,
      insertBlock: (type: InsertBlockType) => appendBlock(makeBlock(type)),
      deleteCurrentBlock,
    },
    destroy(): void {
      destroyed = true;
      cleanup.forEach((fn) => fn());
      hideHandle();
      hideImgResize();
      hideTableUi();
    },
  };
}