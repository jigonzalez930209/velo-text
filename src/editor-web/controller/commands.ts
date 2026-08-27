import type { BlockNode } from "../../core/model/types.js";
import { createText, createImageBlock, createTable, createParagraph, createHeading, createColumns } from "../../core/model/factories.js";
import type { EditorState, InsertBlockType } from "./types.js";
import { BLOCK_SEL } from "./types.js";
import { commitInsert, deleteCurrent, insertAfterId } from "./nesting.js";

export function makeBlock(s: EditorState, type: InsertBlockType): BlockNode {
  const { idGen } = s;
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
    case "columns": return createColumns(idGen, 2);
    default: return createParagraph(idGen, [createText(idGen, "")]);
  }
}

function exec(s: EditorState, cmd: string, value?: string): void {
  try { s.ownerDoc.execCommand(cmd, false, value as never); } catch { /* ignore */ }
}

const MARK_CMDS: Record<string, string> = { bold: "bold", italic: "italic", underline: "underline", strike: "strikeThrough", code: "" };

export function bindCommands(s: EditorState) {
  function wrapSelection(tag: string): void {
    const sel = s.selection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const el = s.ownerDoc.createElement(tag);
    try { range.surroundContents(el); } catch {
      const frag = range.extractContents();
      el.appendChild(frag);
      range.insertNode(el);
    }
    sel.removeAllRanges();
    const r = s.ownerDoc.createRange();
    r.selectNodeContents(el);
    sel.addRange(r);
  }

  function insertInlineAtCaret(el: HTMLElement): void {
    s.container.focus();
    const sel = s.selection();
    let range: Range;
    if (sel && sel.rangeCount) { range = sel.getRangeAt(0); range.collapse(false); }
    else { range = s.ownerDoc.createRange(); range.selectNodeContents(s.container); range.collapse(false); }
    range.insertNode(el);
    range.setStartAfter(el);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    s.lastChangeTime = 0;
    s.syncFromDom(false);
  }

  return {
    insertBlockAfter(blockEl: HTMLElement, type: InsertBlockType): void {
      insertAfterId(s, s.blockIdOf(blockEl), makeBlock(s, type));
    },
    toggleMark(mark: string): void {
      s.container.focus();
      const cmd = MARK_CMDS[mark];
      if (cmd) exec(s, cmd);
      else if (mark === "code") wrapSelection("code");
      s.syncFromDom();
    },
    setHeading(level: number | null): void {
      s.container.focus();
      exec(s, "formatBlock", level ? `H${level}` : "P");
      s.syncFromDom();
    },
    toggleList(kind: "ordered" | "unordered"): void {
      s.container.focus();
      exec(s, kind === "ordered" ? "insertOrderedList" : "insertUnorderedList");
      s.syncFromDom();
    },
    toggleQuote(): void {
      s.container.focus();
      exec(s, "formatBlock", "blockquote");
      s.syncFromDom();
    },
    setAlign(align: string): void {
      const target = alignTarget(s);
      if (!target) return;
      target.style.textAlign = align;
      if (target.matches("td, th")) {
        for (const inner of Array.from(target.querySelectorAll(":scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > blockquote"))) {
          (inner as HTMLElement).style.textAlign = align;
        }
      }
      s.syncFromDom();
    },
    clearFormat(): void {
      s.container.focus();
      exec(s, "removeFormat");
      s.syncFromDom();
    },
    insertVariable(path: string, format?: string, fallback?: string): void {
      const source = `{{${path}${format ? ` | ${format}` : ""}${fallback ? ` ?? "${fallback}"` : ""}}}`;
      const span = s.ownerDoc.createElement("span");
      span.setAttribute("data-node-type", "variable");
      span.setAttribute("data-node-id", s.idGen.next());
      span.setAttribute("data-path", path);
      span.setAttribute("data-source", source);
      span.setAttribute("contenteditable", "false");
      span.className = "pde-variable";
      span.textContent = source;
      insertInlineAtCaret(span);
    },
    insertEquation(latex: string): void {
      const span = s.ownerDoc.createElement("span");
      span.setAttribute("data-node-type", "equation");
      span.setAttribute("data-node-id", s.idGen.next());
      span.setAttribute("data-latex", latex);
      span.setAttribute("contenteditable", "false");
      span.className = "pde-equation";
      span.textContent = latex;
      insertInlineAtCaret(span);
    },
    insertImage(assetId: string, widthUm = 150000, heightUm = 90000): void {
      commitInsert(s, createImageBlock(s.idGen, assetId, { alt: "image", widthUm, heightUm }));
    },
    insertTable(rows = 2, cols = 2): void {
      commitInsert(s, createTable(s.idGen, cols, rows));
    },
    insertColumns(countOrPcts: number | number[] = 2): void {
      commitInsert(s, createColumns(s.idGen, countOrPcts));
    },
    insertBlock(type: InsertBlockType): void {
      commitInsert(s, makeBlock(s, type));
    },
    deleteCurrentBlock(): void {
      deleteCurrent(s);
    },
  };
}

function alignTarget(s: EditorState): HTMLElement | null {
  const sel = s.selection();
  const node = sel?.anchorNode as Node | null;
  const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
  if (!el || !s.container.contains(el)) return s.currentBlockEl();
  const cell = el.closest("td, th") as HTMLElement | null;
  if (cell && s.container.contains(cell)) {
    const inner = cell.querySelector(":scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > blockquote") as HTMLElement | null;
    return inner ?? cell;
  }
  const block = el.closest(BLOCK_SEL) as HTMLElement | null;
  return block && s.container.contains(block) ? block : s.currentBlockEl();
}
