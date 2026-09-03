import type { BlockNode } from "../../core/model/types.js";
import { breakLines, findMissingGlyphs } from "./text.js";
import { box, ensureSpace, pushPage, type LayoutFlow } from "./layout-flow.js";
import { layoutStructuredBlock } from "./layout-structured.js";

export type { LayoutFlow } from "./layout-flow.js";

export function layoutBlock(flow: LayoutFlow, block: BlockNode): void {
  if (layoutStructuredBlock(flow, block)) return;
  const { margin, usableWidthUm, lineHeightDefault, opts, diagnostics } = flow;
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "quote": {
      const text = (block.children ?? [])
        .map((c) => {
          if (c.type === "text") return c.text;
          if (c.type === "variable") return c.source;
          if (c.type === "equation") return `$${(c as unknown as { latex: string }).latex}$`;
          if (c.type === "hard-break") return "\n";
          if (c.type === "footnote-ref") {
            const mark = (c as unknown as { customMark?: string }).customMark ?? "1";
            return `[${mark}]`;
          }
          return "";
        })
        .join("");
      const fontSizePt = block.type === "heading" ? 14 + (6 - (block as unknown as { level: number }).level) : 11;
      const lines = breakLines(text, { maxWidthUm: usableWidthUm, defaultFontSizePt: fontSizePt });
      const missing = findMissingGlyphs(text);
      if (missing.length) {
        diagnostics.push({ code: "missing-glyph", message: `Missing glyphs: ${missing.slice(0, 5).join("")}`, severity: "warn" });
      }
      const widows = opts.widows ?? 2;
      const orphans = opts.orphans ?? 2;
      const paraHeight = lines.length * lineHeightDefault;
      const wouldSplit = flow.cursorY + paraHeight > margin.top + flow.usableHeightUm;
      const linesOnCurrentPage = Math.floor((margin.top + flow.usableHeightUm - flow.cursorY) / lineHeightDefault);
      if (wouldSplit && linesOnCurrentPage < widows && lines.length >= widows + orphans) {
        pushPage(flow);
      }
      for (let i = 0; i < lines.length; i++) {
        ensureSpace(flow, lineHeightDefault);
        const line = lines[i]!;
        flow.currentPage.boxes.push(box({
          id: `${block.id}_line_${i}`,
          type: block.type,
          xUm: margin.left,
          yUm: flow.cursorY,
          widthUm: usableWidthUm,
          heightUm: lineHeightDefault,
          content: line.text,
        }));
        flow.cursorY += lineHeightDefault;
      }
      flow.cursorY += Math.round(lineHeightDefault * 0.3);

      const footnoteRefs = (block.children ?? []).filter((c) => c.type === "footnote-ref");
      for (const fnRef of footnoteRefs) {
        const fnId = (fnRef as unknown as { footnoteId: string }).footnoteId;
        const mark = (fnRef as unknown as { customMark?: string }).customMark ?? "1";
        const fnDef = flow.doc?.footnotes?.[fnId];
        if (fnDef) {
          const fnText = fnDef.blocks
            .map((b) => (b.type === "paragraph" ? (b.children ?? []).map((c) => (c.type === "text" ? c.text : "")).join("") : ""))
            .join(" ");
          const fnHeight = Math.round(lineHeightDefault * 0.9);
          flow.footnoteReserveUm = (flow.footnoteReserveUm ?? 0) + fnHeight + 2000;
          if (!flow.currentPage.footnoteBoxes) flow.currentPage.footnoteBoxes = [];
          flow.currentPage.footnoteBoxes.push({
            id: `fn_${fnId}`,
            type: "footnote",
            xUm: margin.left,
            yUm: 0,
            widthUm: usableWidthUm,
            heightUm: fnHeight,
            content: `${mark} ${fnText}`,
          });
        }
      }
      break;
    }
    case "list": {
      for (const item of block.items) {
        const text = item.content
          .map((c) => {
            const cc = c as unknown as { text?: string; source?: string; latex?: string; type: string };
            if (cc.type === "equation") return `$${cc.latex}$`;
            return cc.text ?? cc.source ?? "";
          })
          .join("");
        let prefix = block.kind === "ordered" ? "1. " : "• ";
        if (item.checked !== undefined) {
          prefix = item.checked ? "[x] " : "[ ] ";
        }
        const lines = breakLines(prefix + text, { maxWidthUm: usableWidthUm });
        for (const line of lines) {
          ensureSpace(flow, lineHeightDefault);
          flow.currentPage.boxes.push(box({
            id: `${item.id}_line`,
            type: "list-item",
            xUm: margin.left,
            yUm: flow.cursorY,
            widthUm: usableWidthUm,
            heightUm: lineHeightDefault,
            content: line.text,
          }));
          flow.cursorY += lineHeightDefault;
        }
        if (item.nested) layoutBlock(flow, item.nested as unknown as BlockNode);
      }
      flow.cursorY += Math.round(lineHeightDefault * 0.2);
      break;
    }
    default:
      diagnostics.push({ code: "unknown-block", message: `Unknown block type ${(block as { type: string }).type}`, severity: "warn" });
  }
}
