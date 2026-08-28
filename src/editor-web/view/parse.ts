/**
 * DOM → AST parser — parses contenteditable DOM into PortableDocument.
 */
import type { PortableDocument, BlockNode, TableNode, TableRow, TableCell, TableLook, TablePreset, TableStyle, IdGenerator } from "../../core/model/types.js";
import { pxToUm } from "../../export/layout/units.js";
import { parseInlines, nodeId } from "./parse-inlines.js";

export { parseInlines } from "./parse-inlines.js";

const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "UL", "OL", "TABLE", "HR", "FIGURE", "DIV"]);

export function parseBlockEl(el: HTMLElement, idGen: IdGenerator): BlockNode | null {
  const tag = el.tagName.toUpperCase();
  const ntype = el.getAttribute("data-node-type");
  const id = nodeId(el, idGen);

  if (ntype === "page-break") return { type: "page-break", id };
  if (ntype === "equation-block") return { type: "equation-block", id, latex: el.getAttribute("data-latex") ?? "" };
  if (ntype === "columns") {
    const cols = [];
    for (const child of Array.from(el.children)) {
      const colEl = child as HTMLElement;
      if (!colEl.classList.contains("pde-column")) continue;
      const colId = nodeId(colEl, idGen);
      const blocks: BlockNode[] = [];
      for (const bEl of Array.from(colEl.children)) {
        const b = parseBlockEl(bEl as HTMLElement, idGen);
        if (b) blocks.push(b);
      }
      if (!blocks.length) blocks.push({ type: "paragraph", id: `${colId}_p`, children: [{ type: "text", id: `${colId}_t0`, text: "" }] });
      const widthPct = Number(colEl.getAttribute("data-width-pct")) || undefined;
      cols.push({ id: colId, blocks, ...(widthPct ? { widthPct } : {}) });
    }
    return { type: "columns", id, columns: cols };
  }
  // Inline atomic nodes appearing as direct container children get wrapped in a paragraph
  if (ntype === "variable") {
    return {
      type: "paragraph",
      id: `${id}_w`,
      children: [{
        type: "variable",
        id,
        path: el.getAttribute("data-path") ?? "",
        source: el.getAttribute("data-source") ?? el.textContent ?? "",
        valueType: "unknown",
      }],
    };
  }
  if (ntype === "equation") {
    return { type: "paragraph", id: `${id}_w`, children: [{ type: "equation", id, latex: el.getAttribute("data-latex") ?? "" }] };
  }
  if (ntype === "image" || tag === "FIGURE") {
    const imgEl = el.querySelector("img");
    const assetId = el.getAttribute("data-asset-id") ?? imgEl?.getAttribute("data-asset-id") ?? "";
    const wUm = Number(el.getAttribute("data-width-um")) || undefined;
    const hUm = Number(el.getAttribute("data-height-um")) || undefined;
    const alt = el.getAttribute("data-alt") ?? imgEl?.getAttribute("alt") ?? "";
    const title = el.getAttribute("data-title") ?? el.querySelector("figcaption")?.textContent ?? "";
    const alignRaw = el.style?.textAlign;
    const align = alignRaw && (alignRaw === "center" || alignRaw === "right") ? alignRaw : undefined;
    return { type: "image", id, assetId, alt, ...(title ? { title } : {}), ...(wUm ? { widthUm: wUm } : {}), ...(hUm ? { heightUm: hUm } : {}), ...(align ? { align } : {}) };
  }
  if (/^H[1-6]$/.test(tag)) {
    return { type: "heading", id, level: Number(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6, children: parseInlines(el, idGen, {}, id) };
  }
  if (tag === "BLOCKQUOTE") {
    return { type: "quote", id, children: parseInlines(el, idGen, {}, id) };
  }
  if (tag === "UL" || tag === "OL") {
    const kind = tag === "UL" ? "unordered" : "ordered";
    const items = [];
    for (const li of Array.from(el.children)) {
      if (li.tagName.toUpperCase() !== "LI") continue;
      const liEl = li as HTMLElement;
      const nested = Array.from(liEl.children).find((c) => c.tagName.toUpperCase() === "UL" || c.tagName.toUpperCase() === "OL") as HTMLElement | undefined;
      const contentEl = liEl.cloneNode(true) as HTMLElement;
      if (nested) (nested as HTMLElement).remove();
      const liId = nodeId(liEl, idGen);
      items.push({
        id: liId,
        content: parseInlines(contentEl, idGen, {}, liId),
        ...(nested ? { nested: parseBlockEl(nested, idGen) as never } : {}),
      });
    }
    return { type: "list", id, kind, items } as BlockNode;
  }
  if (tag === "TABLE") {
    return parseTable(el, idGen);
  }
  if (tag === "HR") return { type: "horizontal-rule", id };

  // Default: paragraph (also <div>, generic elements)
  const style = (el as HTMLElement).style;
  const align = style?.textAlign && style.textAlign !== "left" ? (style.textAlign as "left" | "center" | "right" | "justify") : undefined;
  // Empty paragraphs render as a single <br> — parse that back as an empty text node
  const onlyBr = el.children.length === 1 && el.children[0]!.tagName.toUpperCase() === "BR" && !(el.textContent ?? "").trim();
  const children = onlyBr ? [] : parseInlines(el, idGen, {}, id);
  if (onlyBr) children.push({ type: "text", id: `${id}_t0`, text: "" });
  const indentRaw = el.getAttribute("data-indent-level") || (style?.paddingLeft ? String(Math.round(parseFloat(style.paddingLeft) / 24)) : "");
  const indentLevel = Number(indentRaw) || undefined;
  return { type: "paragraph", id, children, ...(align ? { align } : {}), ...(indentLevel ? { indentLevel } : {}) };
}

function parseTable(el: HTMLElement, idGen: IdGenerator): TableNode {
  const id = nodeId(el, idGen);
  // Column widths from colgroup
  const colEls = Array.from(el.querySelectorAll("colgroup col"));
  let columns: Array<{ id: string; widthUm: number }> = [];
  if (colEls.length) {
    columns = colEls.map((c) => {
      const cEl = c as HTMLElement;
      const um = Number(cEl.getAttribute("data-col-width-um"));
      const w = parseFloat(cEl.style.width) || 0;
      return { id: cEl.getAttribute("data-col-id") || idGen.next(), widthUm: um > 0 ? um : (w > 0 ? pxToUm(w) : 40000) };
    });
  }

  // Rows: collect TRs from tbody/thead children and direct TR children
  const rowEls: HTMLElement[] = [];
  for (const child of Array.from(el.children)) {
    const t = child.tagName.toUpperCase();
    if (t === "TBODY" || t === "THEAD" || t === "TFOOT") {
      for (const tr of Array.from(child.children)) if (tr.tagName.toUpperCase() === "TR") rowEls.push(tr as HTMLElement);
    } else if (t === "TR") {
      rowEls.push(child as HTMLElement);
    }
  }

  const rows: TableRow[] = [];
  for (const trEl of rowEls) {
    const cells: TableCell[] = [];
    let tdElIsTh = false;
    for (const td of Array.from(trEl.children)) {
      if (td.tagName.toUpperCase() !== "TD" && td.tagName.toUpperCase() !== "TH") continue;
      const tdEl = td as HTMLElement;
      if (tdEl.tagName.toUpperCase() === "TH") tdElIsTh = true;
      const colSpan = Number(tdEl.getAttribute("colspan")) || 1;
      const rowSpan = Number(tdEl.getAttribute("rowspan")) || 1;
      const tdId = nodeId(tdEl, idGen);
      // Cell blocks: block elements inside; text nodes wrapped into a paragraph
      const blocks: BlockNode[] = [];
      let textAcc: Text[] = [];
      const flushText = () => {
        if (!textAcc.length) return;
        const holder = el.ownerDocument.createElement("div");
        for (const t of textAcc) holder.appendChild(t.cloneNode(true));
        blocks.push({ type: "paragraph", id: `${tdId}_p`, children: parseInlines(holder, idGen, {}, `${tdId}_p`) });
        textAcc = [];
      };
      for (const child of Array.from(tdEl.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          textAcc.push(child as Text);
          continue;
        }
        if (child.nodeType === Node.ELEMENT_NODE) {
          const childEl = child as HTMLElement;
          if (BLOCK_TAGS.has(childEl.tagName.toUpperCase()) && childEl.tagName.toUpperCase() !== "DIV") {
            flushText();
            const b = parseBlockEl(childEl, idGen);
            if (b) blocks.push(b);
          } else if (childEl.tagName.toUpperCase() === "DIV" && childEl.getAttribute("data-node-type")) {
            flushText();
            const b = parseBlockEl(childEl, idGen);
            if (b) blocks.push(b);
          } else {
            textAcc.push(...Array.from(childEl.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE) as Text[]);
            textAcc.push(childEl as unknown as Text);
          }
        }
      }
      flushText();
      if (!blocks.length) blocks.push({ type: "paragraph", id: `${tdId}_p`, children: [] });
      const bg = (tdEl.style.backgroundColor || tdEl.style.background || "").trim();
      const cellStyle = bg ? { background: bg } : undefined;
      cells.push({ id: tdId, colSpan, rowSpan, blocks, ...(cellStyle ? { style: cellStyle } : {}) });
    }
    const hUm = Number(trEl.getAttribute("data-height-um")) || undefined;
    const header = trEl.getAttribute("data-header") === "true" || trEl.parentElement?.tagName.toUpperCase() === "THEAD" || tdElIsTh;
    rows.push({ id: nodeId(trEl, idGen), cells, ...(header ? { header: true as const } : {}), ...(hUm ? { heightUm: hUm } : {}) });
  }

  if (!columns.length) {
    const colCount = Math.max(1, ...rows.map((r) => r.cells.reduce((n, c) => n + c.colSpan, 0)));
    columns = Array.from({ length: colCount }, () => ({ id: idGen.next(), widthUm: 40000 }));
  }

  const style = tableStyleFromClass(el.className);
  return { type: "table", id, columns, rows, ...(style ? { style } : {}) };
}

function tableStyleFromClass(className: string): TableStyle | undefined {
  const density = (["compact", "normal", "large"] as const).find((d) => className.includes(`pde-table--${d}`));
  const preset = (["grid-banded", "list-header", "accent", "plain", "grid", "list"] as const).find((p) =>
    className.includes(`pde-table--${p}`),
  ) as TablePreset | undefined;
  const look: TableLook = {};
  if (className.includes("pde-table--banded-rows")) look.bandedRows = true;
  if (className.includes("pde-table--banded-cols")) look.bandedColumns = true;
  if (className.includes("pde-table--first-col")) look.firstColumn = true;
  if (className.includes("pde-table--last-col")) look.lastColumn = true;
  if (className.includes("pde-table--total-row")) look.totalRow = true;
  if (preset === "grid" || preset === "grid-banded" || preset === "list" || preset === "list-header" || preset === "accent") {
    look.headerRow = true;
  }
  if (!density && !preset && !Object.keys(look).length) return undefined;
  return { ...(density ? { density } : {}), ...(preset ? { preset } : {}), ...(Object.keys(look).length ? { look } : {}) };
}

/**
 * Parse the whole editor container into a PortableDocument.
 * Preserves ids from data-node-id; keeps document metadata/envelope from `prev`.
 */
const UI_OVERLAY_CLASSES = ["pde-block-handle", "pde-block-menu", "pde-image-resize", "pde-col-resize", "pde-table-menu"];

export function domToAst(container: HTMLElement, prev: PortableDocument, idGen: IdGenerator): PortableDocument {
  const doc: PortableDocument = JSON.parse(JSON.stringify(prev));
  doc.root.children = [];
  for (const el of Array.from(container.children)) {
    const el2 = el as HTMLElement;
    // Skip transient UI overlays (block handles, menus, resize handles)
    if (UI_OVERLAY_CLASSES.some((c) => el2.classList.contains(c))) continue;
    const block = parseBlockEl(el2, idGen);
    if (block) doc.root.children.push(block);
  }
  return doc;
}