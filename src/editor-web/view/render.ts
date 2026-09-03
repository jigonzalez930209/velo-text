/**
 * Renderer and reconciler — Phase 4.1.1 / 4.1.2
 * Controlled contenteditable host, data-node-id/type, reconciliation by IDs.
 * DOM is a reflection of the AST; AST is the source of truth.
 */
import type { PortableDocument, BlockNode, InlineNode } from "../../core/model/types.js";
import { isTableLookFill, resolvedLook, tableClassName } from "../../core/model/table-look.js";
import { snapOfficeHex } from "../../core/model/office-colors.js";
import { latexToHtml } from "../../core/equation/index.js";
import { highlightCodeToHtml } from "../../core/code-highlight/index.js";

export interface RenderOptions {
  theme?: string;
  editable?: boolean;
  resolveAssetUrl?: (assetId: string) => string | undefined;
}

export function renderBlocksToHtml(doc: PortableDocument, resolveAssetUrl?: RenderOptions["resolveAssetUrl"]): string {
  return doc.root.children.map((b) => renderBlock(b, resolveAssetUrl)).join("");
}

export function renderDocumentToHtml(doc: PortableDocument, opts: RenderOptions = {}): string {
  const blocks = renderBlocksToHtml(doc, opts.resolveAssetUrl);
  return `<div class="pde-root" data-pde-theme="${opts.theme ?? "light-neutral"}" contenteditable="${opts.editable ?? true ? "true" : "false"}">${blocks}</div>`;
}

function renderBlock(block: BlockNode, resolve?: RenderOptions["resolveAssetUrl"]): string {
  const id = block.id;
  switch (block.type) {
    case "paragraph":
      return `<p data-node-id="${id}" data-node-type="paragraph"${blockStyle(block)}>${(block.children ?? []).map((n) => renderInline(n, resolve)).join("") || "<br>"}</p>`;
    case "heading":
      return `<h${block.level} data-node-id="${id}" data-node-type="heading"${alignStyle(block)}>${(block.children ?? []).map((n) => renderInline(n, resolve)).join("")}</h${block.level}>`;
    case "quote":
      return `<blockquote data-node-id="${id}" data-node-type="quote"${alignStyle(block)}>${(block.children ?? []).map((n) => renderInline(n, resolve)).join("")}</blockquote>`;
    case "list": {
      const tag = block.kind === "ordered" ? "ol" : "ul";
      const items = block.items
        .map((it) => `<li data-node-id="${it.id}">${it.content.map((n) => renderInline(n, resolve)).join("")}${it.nested ? renderBlock(it.nested, resolve) : ""}</li>`)
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
      const look = resolvedLook(block);
      const rows = block.rows
        .map((row, ri) => {
          const headerFg = Boolean(look.headerRow && ri === 0);
          const isHeaderRow = headerFg || Boolean(row.header);
          const hPx = row.heightUm ? ` style="height:${Math.round((row.heightUm / 25400) * 96)}px" data-height-um="${row.heightUm}"` : "";
          const hdr = isHeaderRow ? ` data-header="true"` : "";
          const cells = row.cells
            .map((cell, colIndex) => {
              const tag = isHeaderRow ? "th" : "td";
              const inner = cell.blocks.map((bl) => renderBlock(bl, resolve)).join("") || "<p><br></p>";
              const rawBg = typeof cell.style?.background === "string" ? cell.style.background : "";
              const custom = rawBg && !isTableLookFill(rawBg) ? snapOfficeHex(rawBg) : "";
              const vaRaw = typeof cell.style?.vAlign === "string" ? cell.style.vAlign : "middle";
              const va = vaRaw === "top" || vaRaw === "bottom" ? vaRaw : "middle";
              const st = [
                custom ? `background:${custom}` : "",
                `vertical-align:${va}`,
              ].filter(Boolean).join(";");
              const styleAttr = ` style="${st}"`;
              return `<${tag} data-node-id="${cell.id}" colspan="${cell.colSpan}" rowspan="${cell.rowSpan}" data-col-index="${colIndex}" data-valign="${va}"${styleAttr}>${inner}</${tag}>`;
            })
            .join("");
          return `<tr data-node-id="${row.id}"${hPx}${hdr}>${cells}</tr>`;
        })
        .join("");
      const lookJson = block.style?.look ? ` data-look="${escapeAttr(JSON.stringify(block.style.look))}"` : "";
      return `<table class="${tableClassName(block)}" data-node-id="${id}" data-node-type="table"${lookJson} style="table-layout:fixed;width:100%"><colgroup>${colsHtml}</colgroup><tbody>${rows}</tbody></table>`;
    }
    case "image": {
      const wUm = block.widthUm ?? 150000;
      const hUm = block.heightUm ?? 90000;
      const wPx = Math.round((wUm / 25400) * 96);
      const align = (block as { align?: string }).align;
      const figStyle = align && align !== "left" ? ` style="text-align:${align}"` : "";
      const cap = block.title ? `<figcaption>${escapeAttr(block.title)}</figcaption>` : "";
      const src = assetSrc(block.assetId, resolve);
      return `<figure contenteditable="false" draggable="true" data-node-id="${id}" data-node-type="image" data-asset-id="${block.assetId}" data-width-um="${wUm}" data-height-um="${hUm}" data-alt="${escapeAttr(block.alt ?? "")}"${block.title ? ` data-title="${escapeAttr(block.title)}"` : ""} class="pde-image-block"${figStyle}><img data-asset-id="${block.assetId}" alt="${escapeAttr(block.alt ?? "")}" draggable="true" style="width:${wPx}px;height:auto;aspect-ratio:${wUm}/${hUm}"${src} />${cap}</figure>`;
    }
    case "columns": {
      const cols = block.columns
        .map((col, i) => {
          const pct = col.widthPct ?? Math.round(100 / Math.max(1, block.columns.length));
          const inner = col.blocks.map((bl) => renderBlock(bl, resolve)).join("") || "<p><br></p>";
          const va = col.vAlign === "middle" || col.vAlign === "bottom" ? col.vAlign : "top";
          return `<div class="pde-column" data-node-id="${col.id}" data-col-index="${i}" data-width-pct="${pct}" data-valign="${va}" style="flex:0 0 ${pct}%;width:${pct}%;max-width:${pct}%">${inner}</div>`;
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
    case "code-block": {
      const codeHtml = highlightCodeToHtml(
        block.code ?? "",
        block.language ?? "plain",
        block.showLineNumbers !== false,
        block.lineStart ?? 1
      );
      return `<div data-node-id="${id}" data-node-type="code-block" class="pde-code-block" data-language="${block.language}">${codeHtml}</div>`;
    }
    case "callout": {
      const variant = block.variant ?? "info";
      const titleHtml = block.title
        ? `<div class="pde-callout-title" data-callout-title="true"><strong>${escapeHtml(block.title)}</strong></div>`
        : "";
      const childrenHtml = (block.children ?? []).map((b) => renderBlock(b, resolve)).join("");
      return `<aside data-node-id="${id}" data-node-type="callout" class="pde-callout pde-callout--${variant}" data-variant="${variant}">${titleHtml}${childrenHtml}</aside>`;
    }
    default:
      return `<div data-node-id="${id}">[${(block as { type: string }).type}]</div>`;
  }
}

function renderInline(inline: InlineNode, resolve?: RenderOptions["resolveAssetUrl"]): string {
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
      const st: string[] = [];
      if (m.color) st.push(`color:${m.color}`);
      if (m.background) st.push(`background:${m.background}`);
      if (m.fontSizePt) st.push(`font-size:${m.fontSizePt}pt`);
      if (m.fontFamily) st.push(`font-family:"${String(m.fontFamily).replace(/"/g, '\\"')}"`);
      if (st.length) s = `<span style="${st.join(";")}">${s}</span>`;
      return s;
    }
    case "variable":
      return `<span data-node-id="${inline.id}" data-node-type="variable" contenteditable="false" class="pde-variable" role="button" tabindex="0" data-path="${escapeAttr((inline as unknown as { path: string }).path)}" data-source="${escapeAttr(inline.source)}"${(inline as { format?: string }).format ? ` data-format="${escapeAttr((inline as { format: string }).format)}"` : ""}${(inline as { fallback?: string }).fallback ? ` data-fallback="${escapeAttr((inline as { fallback: string }).fallback)}"` : ""} aria-label="Variable ${escapeAttr((inline as unknown as { path: string }).path)}">${escapeHtml(inline.source)}</span>`;
    case "link":
      return `<a data-node-id="${inline.id}" href="${escapeAttr(inline.href)}" data-node-type="link">${inline.children.map((n) => renderInline(n, resolve)).join("")}</a>`;
    case "inline-image":
      return `<img data-node-id="${inline.id}" data-asset-id="${inline.assetId}" class="pde-inline-image" alt=""${assetSrc(inline.assetId, resolve)} />`;
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

function blockStyle(block: { align?: string; indentLevel?: number } | object): string {
  const b = block as { align?: string; indentLevel?: number };
  const parts: string[] = [];
  if (b.align) parts.push(`text-align:${b.align}`);
  if (b.indentLevel) parts.push(`padding-left:${b.indentLevel * 1.5}em`);
  const indentAttr = b.indentLevel ? ` data-indent-level="${b.indentLevel}"` : "";
  const style = parts.length ? ` style="${parts.join(";")}"` : "";
  return `${indentAttr}${style}`;
}

function alignStyle(block: { align?: string } | object): string {
  const align = (block as { align?: string }).align;
  return align ? ` style="text-align:${align}"` : "";
}

function assetSrc(assetId: string, resolve?: RenderOptions["resolveAssetUrl"]): string {
  const url = resolve?.(assetId);
  return url ? ` src="${escapeAttr(url)}"` : "";
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
