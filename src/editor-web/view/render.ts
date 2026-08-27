/**
 * Renderer and reconciler — Phase 4.1.1 / 4.1.2
 * Controlled contenteditable host, data-node-id/type, reconciliation by IDs.
 * DOM is a reflection of the AST; AST is the source of truth.
 */
import type { PortableDocument, BlockNode, InlineNode } from "../../core/model/types.js";
import { latexToHtml } from "../../core/equation/index.js";

export interface RenderOptions {
  theme?: string;
  editable?: boolean;
}

export function renderBlocksToHtml(doc: PortableDocument): string {
  return doc.root.children.map((b) => renderBlock(b)).join("");
}

export function renderDocumentToHtml(doc: PortableDocument, opts: RenderOptions = {}): string {
  const blocks = renderBlocksToHtml(doc);
  return `<div class="pde-root" data-pde-theme="${opts.theme ?? "light-neutral"}" contenteditable="${opts.editable ?? true ? "true" : "false"}">${blocks}</div>`;
}

function renderBlock(block: BlockNode): string {
  const id = block.id;
  switch (block.type) {
    case "paragraph":
      return `<p data-node-id="${id}" data-node-type="paragraph"${alignStyle(block)}>${(block.children ?? []).map(renderInline).join("") || "<br>"}</p>`;
    case "heading":
      return `<h${block.level} data-node-id="${id}" data-node-type="heading"${alignStyle(block)}>${(block.children ?? []).map(renderInline).join("")}</h${block.level}>`;
    case "quote":
      return `<blockquote data-node-id="${id}" data-node-type="quote"${alignStyle(block)}>${(block.children ?? []).map(renderInline).join("")}</blockquote>`;
    case "list": {
      const tag = block.kind === "ordered" ? "ol" : "ul";
      const items = block.items
        .map((it) => `<li data-node-id="${it.id}">${it.content.map(renderInline).join("")}${it.nested ? renderBlock(it.nested) : ""}</li>`)
        .join("");
      return `<${tag} data-node-id="${id}" data-node-type="list">${items}</${tag}>`;
    }
    case "table": {
      const colsHtml = block.columns
        .map((c) => {
          const defaultW = 40000;
          const style = c.widthUm && c.widthUm !== defaultW ? ` style="width:${Math.round((c.widthUm / 25400) * 96)}px"` : "";
          return `<col data-col-id="${c.id}" data-col-width-um="${c.widthUm}"${style} />`;
        })
        .join("");
      const rows = block.rows
        .map((row) => {
          const hPx = row.heightUm ? ` style="height:${Math.round((row.heightUm / 25400) * 96)}px" data-height-um="${row.heightUm}"` : "";
          const cells = row.cells
            .map((cell, colIndex) => {
              const tag = row.header ? "th" : "td";
              const inner = cell.blocks.map(renderBlock).join("") || "<p><br></p>";
              return `<${tag} data-node-id="${cell.id}" colspan="${cell.colSpan}" rowspan="${cell.rowSpan}" data-col-index="${colIndex}">${inner}</${tag}>`;
            })
            .join("");
          return `<tr data-node-id="${row.id}"${hPx}>${cells}</tr>`;
        })
        .join("");
      return `<table class="pde-table" data-node-id="${id}" data-node-type="table" style="table-layout:fixed;width:100%"><colgroup>${colsHtml}</colgroup><tbody>${rows}</tbody></table>`;
    }
    case "image": {
      const wUm = block.widthUm ?? 150000;
      const hUm = block.heightUm ?? 90000;
      const wPx = Math.round((wUm / 25400) * 96);
      const hPx = Math.round((hUm / 25400) * 96);
      return `<figure data-node-id="${id}" data-node-type="image" data-asset-id="${block.assetId}" data-width-um="${wUm}" data-height-um="${hUm}" data-alt="${escapeAttr(block.alt ?? "")}" class="pde-image-block"><img data-asset-id="${block.assetId}" alt="${escapeAttr(block.alt ?? "")}" draggable="false" style="width:${wPx}px;height:${hPx}px;display:block" /></figure>`;
    }
    case "columns": {
      const cols = block.columns
        .map((col, i) => {
          const pct = col.widthPct ?? Math.round(100 / Math.max(1, block.columns.length));
          const inner = col.blocks.map(renderBlock).join("") || "<p><br></p>";
          return `<div class="pde-column" data-node-id="${col.id}" data-col-index="${i}" data-width-pct="${pct}" style="flex:0 0 ${pct}%;width:${pct}%;max-width:${pct}%">${inner}</div>`;
        })
        .join("");
      const gapPx = Math.round(((block.gapUm ?? 4000) / 25400) * 96);
      return `<div class="pde-columns" data-node-id="${id}" data-node-type="columns" style="gap:${gapPx}px">${cols}</div>`;
    }
    case "page-break":
      return `<div data-node-id="${id}" data-node-type="page-break" class="pde-page-break" data-page-break="true"></div>`;
    case "horizontal-rule":
      return `<hr data-node-id="${id}" data-node-type="horizontal-rule" />`;
    case "equation-block": {
      const latex = escapeAttr((block as unknown as { latex: string }).latex ?? "");
      const inner = latexToHtml((block as unknown as { latex: string }).latex ?? "");
      return `<div data-node-id="${id}" data-node-type="equation-block" contenteditable="false" class="pde-equation pde-equation--block" role="math" aria-label="${latex}" data-latex="${latex}">${inner}</div>`;
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
      return `<span data-node-id="${inline.id}" data-node-type="variable" contenteditable="false" class="pde-variable" role="button" tabindex="0" data-path="${escapeAttr((inline as unknown as { path: string }).path)}" data-source="${escapeAttr(inline.source)}" aria-label="Variable ${escapeAttr((inline as unknown as { path: string }).path)}">${escapeHtml(inline.source)}</span>`;
    case "link":
      return `<a data-node-id="${inline.id}" href="${escapeAttr(inline.href)}" data-node-type="link">${inline.children.map(renderInline).join("")}</a>`;
    case "inline-image":
      return `<img data-node-id="${inline.id}" data-asset-id="${inline.assetId}" class="pde-inline-image" alt="" />`;
    case "hard-break":
      return `<br data-node-id="${inline.id}" />`;
    case "equation": {
      const latex = (inline as unknown as { latex: string }).latex ?? "";
      const display = (inline as unknown as { display?: boolean }).display;
      const inner = latexToHtml(latex);
      const cls = display ? "pde-equation pde-equation--block" : "pde-equation";
      return `<span data-node-id="${inline.id}" data-node-type="equation" contenteditable="false" class="${cls}" role="math" tabindex="0" aria-label="${escapeAttr(latex)}" data-latex="${escapeAttr(latex)}">${inner}</span>`;
    }
    default:
      return `<span>[${(inline as { type: string }).type}]</span>`;
  }
}

function alignStyle(block: { align?: string } | object): string {
  const align = (block as { align?: string }).align;
  return align ? ` style="text-align:${align}"` : "";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
