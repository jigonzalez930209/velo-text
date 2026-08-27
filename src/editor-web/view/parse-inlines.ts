/**
 * DOM → AST parser — Phase 4.1.1 / 4.1.2
 * Parses the contenteditable DOM back into the canonical PortableDocument.
 * The AST is the source of truth; DOM is an editable view that mirrors it.
 *
 * ID policy (critical for history idempotence):
 *  - elements with `data-node-id` keep their ID
 *  - text nodes / hard breaks get deterministic IDs derived from their parent block
 *    (`<blockId>_t<index>`, `<blockId>_br<index>`) so repeated parses are stable
 *  - inline atomic nodes wrapped at container level get deterministic wrapper IDs
 */
import type { PortableDocument, BlockNode, InlineNode, TextMarks, TableNode, TableRow, TableCell, IdGenerator } from "../../core/model/types.js";
import { pxToUm } from "../../export/layout/units.js";

export function nodeId(el: HTMLElement, idGen: IdGenerator): string {
  return el.getAttribute("data-node-id") || idGen.next();
}

function mergeTexts(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (n.type === "text" && last && last.type === "text" && JSON.stringify((n as { marks?: TextMarks }).marks ?? {}) === JSON.stringify((last as { marks?: TextMarks }).marks ?? {})) {
      (last as { text: string }).text += (n as { text: string }).text;
    } else {
      out.push(n);
    }
  }
  return out;
}

interface ParseCtx {
  baseId: string;
  counter: number;
}

function nextInlineId(ctx: ParseCtx, prefix: string): string {
  return `${ctx.baseId}_${prefix}${ctx.counter++}`;
}

export function parseInlines(root: HTMLElement, idGen: IdGenerator, marks: TextMarks = {}, baseId?: string): InlineNode[] {
  const ctx: ParseCtx = { baseId: baseId ?? root.getAttribute("data-node-id") ?? "n", counter: 0 };
  const out: InlineNode[] = [];
  const walk = (node: Node, m: TextMarks): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text) out.push({ type: "text", id: nextInlineId(ctx, "t"), text, ...(Object.keys(m).length ? { marks: { ...m } } : {}) });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    const ntype = el.getAttribute("data-node-type");
    if (ntype === "variable") {
      out.push({
        type: "variable",
        id: nodeId(el, idGen),
        path: el.getAttribute("data-path") ?? "",
        source: el.getAttribute("data-source") ?? el.textContent ?? "",
        valueType: "unknown",
        ...(Object.keys(m).length ? { marks: { ...m } } : {}),
      });
    } else if (ntype === "equation") {
      out.push({ type: "equation", id: nodeId(el, idGen), latex: el.getAttribute("data-latex") ?? "" });
    } else if (ntype === "link" || tag === "A") {
      out.push({ type: "link", id: nodeId(el, idGen), href: el.getAttribute("href") ?? "#", children: parseInlines(el, idGen, m, baseId) as never });
    } else if (tag === "IMG") {
      out.push({ type: "inline-image", id: nodeId(el, idGen), assetId: el.getAttribute("data-asset-id") ?? "" });
    } else if (tag === "BR") {
      out.push({ type: "hard-break", id: nextInlineId(ctx, "br") });
    } else if (tag === "STRONG" || tag === "B") {
      for (const c of Array.from(el.childNodes)) walk(c, { ...m, bold: true });
    } else if (tag === "EM" || tag === "I") {
      for (const c of Array.from(el.childNodes)) walk(c, { ...m, italic: true });
    } else if (tag === "U") {
      for (const c of Array.from(el.childNodes)) walk(c, { ...m, underline: true });
    } else if (tag === "S" || tag === "DEL") {
      for (const c of Array.from(el.childNodes)) walk(c, { ...m, strike: true });
    } else if (tag === "CODE") {
      for (const c of Array.from(el.childNodes)) walk(c, { ...m, code: true });
    } else {
      for (const c of Array.from(el.childNodes)) walk(c, m);
    }
  };
  for (const child of Array.from(root.childNodes)) walk(child, marks);
  return mergeTexts(out);
}
