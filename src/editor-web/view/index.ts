/**
 * Renderer — Phase 4.1.1
 * Controlled contenteditable host, data-node-id/type, reconciliation by IDs
 */
import type { PortableDocument, BlockNode, InlineNode } from "../../core/model/types.js";
import { latexToHtml } from "../../core/equation/index.js";

export interface RenderOptions {
  theme?: string;
  editable?: boolean;
}

export function renderDocumentToHtml(doc: PortableDocument, opts: RenderOptions = {}): string {
  const blocks = doc.root.children.map((b) => renderBlock(b)).join("");
  return `<div class="pde-root" data-pde-theme="${opts.theme ?? "light-neutral"}" contenteditable="${opts.editable ?? true ? "true" : "false"}">${blocks}</div>`;
}

function renderBlock(block: BlockNode): string {
  const id = block.id;
  switch (block.type) {
    case "paragraph":
      return `<p data-node-id="${id}" data-node-type="paragraph">${(block.children ?? []).map(renderInline).join("") || "<br>"}</p>`;
    case "heading":
      return `<h${block.level} data-node-id="${id}" data-node-type="heading">${(block.children ?? []).map(renderInline).join("")}</h${block.level}>`;
    case "quote":
      return `<blockquote data-node-id="${id}" data-node-type="quote">${(block.children ?? []).map(renderInline).join("")}</blockquote>`;
    case "list": {
      const tag = block.kind === "ordered" ? "ol" : "ul";
      const items = block.items
        .map((it) => `<li data-node-id="${it.id}">${it.content.map(renderInline).join("")}${it.nested ? renderBlock(it.nested) : ""}</li>`)
        .join("");
      return `<${tag} data-node-id="${id}" data-node-type="list">${items}</${tag}>`;
    }
    case "table": {
      const rows = block.rows
        .map((row) => `<tr data-node-id="${row.id}">${row.cells.map((cell) => `<td data-node-id="${cell.id}" colspan="${cell.colSpan}" rowspan="${cell.rowSpan}">${cell.blocks.map(renderBlock).join("")}</td>`).join("")}</tr>`)
        .join("");
      return `<table data-node-id="${id}" data-node-type="table"><tbody>${rows}</tbody></table>`;
    }
    case "image":
      return `<figure data-node-id="${id}" data-node-type="image"><img data-asset-id="${block.assetId}" alt="${escapeAttr(block.alt ?? "")}" /></figure>`;
    case "page-break":
      return `<div data-node-id="${id}" data-node-type="page-break" class="pde-page-break"></div>`;
    case "horizontal-rule":
      return `<hr data-node-id="${id}" data-node-type="horizontal-rule" />`;
    case "equation-block": {
      // Block display equation — centered, atomic, non-editable
      const latex = escapeAttr((block as unknown as { latex: string }).latex ?? "");
      const inner = latexToHtml((block as unknown as { latex: string }).latex ?? "");
      return `<div data-node-id="${id}" data-node-type="equation-block" contenteditable="false" class="pde-equation pde-equation--block" role="math" aria-label="${latex}">${inner}</div>`;
    }
    default:
      return `<div data-node-id="${id}">[${(block as { type: string }).type}]</div>`;
  }
}

function renderInline(inline: InlineNode): string {
  switch (inline.type) {
    case "text": {
      let s = escapeHtml(inline.text);
      const m = inline.marks;
      if (!m) return s;
      if (m.bold) s = `<strong>${s}</strong>`;
      if (m.italic) s = `<em>${s}</em>`;
      if (m.underline) s = `<u>${s}</u>`;
      if (m.strike) s = `<s>${s}</s>`;
      if (m.code) s = `<code>${s}</code>`;
      return s;
    }
    case "variable":
      return `<span data-node-id="${inline.id}" data-node-type="variable" contenteditable="false" class="pde-variable">${escapeHtml(inline.source)}</span>`;
    case "link":
      return `<a data-node-id="${inline.id}" href="${escapeAttr(inline.href)}">${inline.children.map(renderInline).join("")}</a>`;
    case "inline-image":
      return `<img data-node-id="${inline.id}" data-asset-id="${inline.assetId}" class="pde-inline-image" />`;
    case "hard-break":
      return `<br data-node-id="${inline.id}" />`;
    case "equation": {
      const latex = (inline as unknown as { latex: string }).latex ?? "";
      const display = (inline as unknown as { display?: boolean }).display;
      const inner = latexToHtml(latex);
      const cls = display ? "pde-equation pde-equation--block" : "pde-equation";
      return `<span data-node-id="${inline.id}" data-node-type="equation" contenteditable="false" class="${cls}" role="math" aria-label="${escapeAttr(latex)}">${inner}</span>`;
    }
    default:
      return `<span>[${(inline as { type: string }).type}]</span>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export function reconcileDom(_prev: PortableDocument, next: PortableDocument, container: HTMLElement): void {
  // Minimal reconciliation by IDs — full re-render for MVP
  container.innerHTML = renderDocumentToHtml(next);
}
