import type { TextMarks } from "../../core/model/types.js";
import type { EditorState } from "./types.js";
import { BLOCK_SEL } from "./types.js";
import { resolveDocumentFont } from "../../fonts/catalog.js";

function exec(s: EditorState, cmd: string, value?: string): void {
  try { s.ownerDoc.execCommand(cmd, false, value as never); } catch { /* ignore */ }
}

export interface SavedTextSelection {
  blockId: string;
  start: number;
  end: number;
}

function blockForSelection(s: EditorState, blockId?: string): HTMLElement {
  if (blockId) {
    const el = s.container.querySelector(`[data-node-id="${blockId}"]`) as HTMLElement | null;
    if (el && s.container.contains(el)) return el;
  }
  return s.currentBlockEl() ?? s.container;
}

export function captureTextSelection(s: EditorState): SavedTextSelection | null {
  const sel = s.selection();
  if (!sel?.rangeCount || sel.isCollapsed) return null;
  const block = s.currentBlockEl() ?? s.container;
  const offsets = rangeTextOffsets(block, sel.getRangeAt(0));
  if (!offsets) return null;
  const blockId = block.getAttribute("data-node-id") ?? "";
  if (!blockId) return null;
  return { blockId, ...offsets };
}

export function restoreTextSelection(s: EditorState, saved: SavedTextSelection): Range {
  const block = blockForSelection(s, saved.blockId);
  const range = rangeFromTextOffsets(block, saved.start, saved.end);
  const sel = s.selection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  return range;
}

export function captureTextOffsets(s: EditorState): { start: number; end: number } | null {
  const saved = captureTextSelection(s);
  return saved ? { start: saved.start, end: saved.end } : null;
}

export function restoreTextOffsets(s: EditorState, saved: { start: number; end: number }): Range {
  const blockId = s.currentBlockEl()?.getAttribute("data-node-id") ?? "";
  return restoreTextSelection(s, { blockId, ...saved });
}

function rangeTextOffsets(root: Node, range: Range): { start: number; end: number } | null {
  const doc = root.ownerDocument;
  if (!doc) return null;
  const probe = doc.createRange();
  probe.selectNodeContents(root);
  probe.setEnd(range.startContainer, range.startOffset);
  const start = probe.toString().length;
  probe.setEnd(range.endContainer, range.endOffset);
  const end = probe.toString().length;
  return start === end ? null : { start, end };
}

function rangeFromTextOffsets(root: Node, start: number, end: number): Range {
  const doc = root.ownerDocument;
  if (!doc) throw new Error("missing document");
  const range = doc.createRange();
  let count = 0;
  let haveStart = false;
  const visit = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      const next = count + text.length;
      if (!haveStart && next > start) {
        range.setStart(node, Math.max(0, start - count));
        haveStart = true;
      }
      if (haveStart && next >= end) {
        range.setEnd(node, Math.max(0, end - count));
        return true;
      }
      count = next;
      return false;
    }
    for (const child of node.childNodes) {
      if (visit(child)) return true;
    }
    return false;
  };
  visit(root);
  if (!haveStart) range.selectNodeContents(root);
  return range;
}

function fontFamilyElementsInRange(range: Range): HTMLElement[] {
  const root = range.commonAncestorContainer;
  const elements: HTMLElement[] = [];
  const visit = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName;
    if ((tag === "FONT" || tag === "SPAN") && range.intersectsNode(el)) {
      if (tag === "FONT" || el.style.fontFamily) elements.push(el);
    }
    for (const child of el.childNodes) visit(child);
  };
  if (root.nodeType === Node.ELEMENT_NODE) visit(root);
  else if (root.parentElement) visit(root.parentElement);
  return elements.sort((a, b) => {
    if (a.contains(b)) return 1;
    if (b.contains(a)) return -1;
    return 0;
  });
}

function unwrapFontFamilyInRange(range: Range): void {
  for (const el of fontFamilyElementsInRange(range)) {
    const parent = el.parentNode;
    if (!parent) continue;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }
}

export function setColor(s: EditorState, color: string): void {
  const saved = captureTextOffsets(s);
  s.container.focus();
  if (saved) restoreTextOffsets(s, saved);
  exec(s, "foreColor", color);
  s.syncFromDom();
}

export function setHighlight(s: EditorState, color: string): void {
  const saved = captureTextOffsets(s);
  s.container.focus();
  if (saved) restoreTextOffsets(s, saved);
  exec(s, "hiliteColor", color);
  exec(s, "backColor", color);
  s.syncFromDom();
}

export function setFontFamily(s: EditorState, family: string, savedSel?: SavedTextSelection | null): void {
  const saved = savedSel ?? captureTextSelection(s);
  if (!saved) return;
  const canon = resolveDocumentFont(family)?.cssName ?? family;
  const block = blockForSelection(s, saved.blockId);
  s.container.focus();
  const working = restoreTextSelection(s, saved);
  unwrapFontFamilyInRange(working);
  const range = rangeFromTextOffsets(block, saved.start, saved.end);
  const span = s.ownerDoc.createElement("span");
  span.style.fontFamily = `"${canon}"`;
  try {
    range.surroundContents(span);
  } catch {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
  const sel = s.selection();
  sel?.removeAllRanges();
  const next = s.ownerDoc.createRange();
  next.selectNodeContents(span);
  sel?.addRange(next);
  s.syncFromDom();
}

export function setFontSizePt(s: EditorState, pt: number, savedSel?: SavedTextSelection | null): void {
  const saved = savedSel ?? captureTextSelection(s);
  if (!saved) return;
  s.container.focus();
  const range = restoreTextSelection(s, saved);
  const span = s.ownerDoc.createElement("span");
  span.style.fontSize = `${Math.max(8, Math.min(72, pt))}pt`;
  try {
    range.surroundContents(span);
  } catch {
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
  }
  s.syncFromDom();
}

export function indent(s: EditorState, delta: number): void {
  const el = s.currentBlockEl();
  if (!el || el.tagName !== "P") return;
  const cur = Number(el.getAttribute("data-indent-level") || "0");
  const next = Math.max(0, Math.min(6, cur + delta));
  el.setAttribute("data-indent-level", String(next));
  el.style.paddingLeft = next ? `${next * 1.5}em` : "";
  s.syncFromDom();
}

export function insertLink(s: EditorState, href: string): void {
  const url = href.trim();
  if (!/^https?:|^mailto:|^#/i.test(url)) return;
  s.container.focus();
  exec(s, "createLink", url);
  s.syncFromDom();
}

export function marksFromElement(el: HTMLElement): TextMarks {
  const m: TextMarks = {};
  const color = el.style.color;
  const bg = el.style.backgroundColor;
  const fs = el.style.fontSize;
  const ff = el.style.fontFamily;
  if (color) m.color = color;
  if (bg) m.background = bg;
  if (fs) {
    const n = parseFloat(fs);
    if (fs.endsWith("px")) m.fontSizePt = Math.round(n * 72 / 96);
    else if (Number.isFinite(n)) m.fontSizePt = n;
  }
  if (ff) {
    const raw = ff.replace(/['"]/g, "").split(",")[0]?.trim();
    m.fontFamily = resolveDocumentFont(raw)?.cssName ?? raw;
  }
  return m;
}

export { BLOCK_SEL };
