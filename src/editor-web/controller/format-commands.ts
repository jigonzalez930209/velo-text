import type { TextMarks } from "../../core/model/types.js";
import type { EditorState } from "./types.js";
import { BLOCK_SEL } from "./types.js";

function exec(s: EditorState, cmd: string, value?: string): void {
  try { s.ownerDoc.execCommand(cmd, false, value as never); } catch { /* ignore */ }
}

export function setColor(s: EditorState, color: string): void {
  s.container.focus();
  exec(s, "foreColor", color);
  s.syncFromDom();
}

export function setHighlight(s: EditorState, color: string): void {
  s.container.focus();
  exec(s, "hiliteColor", color);
  exec(s, "backColor", color);
  s.syncFromDom();
}

export function setFontFamily(s: EditorState, family: string): void {
  s.container.focus();
  exec(s, "fontName", family);
  s.syncFromDom();
}

export function setFontSizePt(s: EditorState, pt: number): void {
  s.container.focus();
  const sel = s.selection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const span = s.ownerDoc.createElement("span");
  span.style.fontSize = `${Math.max(8, Math.min(72, pt))}pt`;
  try { sel.getRangeAt(0).surroundContents(span); } catch { /* ignore */ }
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
  if (ff) m.fontFamily = ff.replace(/['"]/g, "").split(",")[0]?.trim();
  return m;
}

export { BLOCK_SEL };
