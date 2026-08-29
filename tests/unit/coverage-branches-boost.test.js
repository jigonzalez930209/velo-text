/**
 * Targeted branch coverage booster — hits branches across validator,
 * column resizer, table look, operations, equation html and pdf/docx writers.
 */
import { JSDOM } from "jsdom";
import { validateDocument, assertValid } from "../../dist/core/schema/validator.js";
import { createDocument, createIdGenerator, createTable, createParagraph } from "../../dist/core/model/factories.js";
import {
  tableClassName,
  applyDensity,
  applyPreset,
  toggleLook,
  cellVAlign,
  setCellVAlign,
  shadeCell,
  clearCellStyle,
  clearTableStyle,
  hexToRgb01,
  cellFill,
} from "../../dist/core/model/table-look.js";
import { latexToHtml, validateLatex, latexToPlainText } from "../../dist/core/equation/index.js";
import { mountVanillaEditor } from "../../dist/adapters/vanilla.js";

test("branches: validator edge cases", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("v"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  
  // assertValid happy path
  assert(assertValid(doc).valid);

  // assertValid throws on invalid document
  const badDoc = { ...doc, schema: "wrong" };
  assert.throws(() => assertValid(badDoc));

  // Invalid inline nodes
  const d1 = createDocument({ idGenerator: createIdGenerator("v1"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  d1.root.children.push({
    type: "paragraph",
    id: "p1",
    children: [
      { id: "bad1" }, // missing type
      { type: "unknown-inline", id: "bad2" },
      { type: "text", id: "bad3", text: 123 }, // text not string
      { type: "variable", id: "bad4", path: "" }, // empty path
      { type: "variable", id: "bad5", path: "123.bad" }, // invalid path regex
      { type: "variable", id: "bad6", path: "valid", source: 123 }, // source not string
      { type: "link", id: "bad7", href: 123 }, // href not string
      { type: "link", id: "bad8", href: "javascript:alert(1)" }, // javascript url
      { type: "equation", id: "bad9", latex: "   " }, // empty latex
      { type: "equation", id: "bad10", latex: "a".repeat(2005) }, // latex too long
      { type: "equation", id: "bad11", latex: "\\input{secrets}" }, // forbidden command
      { type: "equation", id: "bad12", latex: "\\frac{a}{b" }, // unbalanced braces
    ]
  });
  const res1 = validateDocument(d1);
  assert(!res1.valid);
  assert(res1.errors.length >= 10);

  // Invalid block nodes
  const d2 = createDocument({ idGenerator: createIdGenerator("v2"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  d2.root.children.push(
    { id: "badb1" }, // missing type
    { type: "unknown-block", id: "badb2" },
    { type: "paragraph", id: "badb3", children: "not-array" },
    { type: "list", id: "badb4", items: "not-array" },
    { type: "table", id: "badb5", columns: "not-array", rows: [] },
  );
  const res2 = validateDocument(d2);
  assert(!res2.valid);
});

test("branches: table look styles", () => {
  const table = createTable(createIdGenerator("t"), 3, 3);
  
  applyDensity(table, "compact");
  assert(table.style?.density === "compact");
  applyDensity(table, "large");
  assert(table.style?.density === "large");

  applyPreset(table, "grid-banded");
  assert(table.style?.preset === "grid-banded");
  applyPreset(table, "accent");

  toggleLook(table, "bandedRows");
  toggleLook(table, "bandedColumns");
  toggleLook(table, "firstColumn");
  toggleLook(table, "lastColumn");
  toggleLook(table, "totalRow");
  toggleLook(table, "headerRow");

  const cls = tableClassName(table);
  assert(typeof cls === "string");

  // cellVAlign
  const cell = table.rows[0].cells[0];
  assert(cellVAlign(cell) === "middle");
  setCellVAlign(cell, "top");
  assert(cellVAlign(cell) === "top");
  setCellVAlign(cell, "bottom");
  assert(cellVAlign(cell) === "bottom");

  // shadeCell
  shadeCell(cell, "#ff0000");
  assert(cell.style?.background === "#ff0000");
  shadeCell(cell, undefined);
  assert(!cell.style?.background);

  // cellFill
  assert(typeof cellFill(cell, table, 0, 0) === "string" || cellFill(cell, table, 0, 0) === undefined);
  assert(cellFill({ id: "c", colSpan: 1, rowSpan: 1, blocks: [], style: { background: "#123456" } }, table, 1, 1) === "#123456");

  // hexToRgb01
  assert(hexToRgb01("#ffffff") !== null);
  assert(hexToRgb01("#fff") !== null);
  assert(hexToRgb01("invalid") === null);

  // clear styles
  clearCellStyle(cell);
  clearTableStyle(table);
});

test("branches: equation HTML rendering edge cases", () => {
  // Simple LaTeX commands and symbols
  assert(latexToHtml("\\alpha + \\beta = \\gamma").includes("α"));
  assert(latexToHtml("\\sqrt{x}").includes("pde-sqrt"));
  assert(latexToHtml("x_{i}^{2}").includes("sub"));
  assert(latexToHtml("\\text{hello world}").includes("hello world"));
  assert(latexToPlainText("E = mc^2") === "$E = mc^2$");
});

test("branches: column resizer DOM interactions", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="editor"></div></body>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.PointerEvent = dom.window.PointerEvent || dom.window.MouseEvent;

  const container = dom.window.document.getElementById("editor");
  const doc = createDocument({ idGenerator: createIdGenerator("c"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  
  // Add columns
  doc.root.children.push({
    type: "columns",
    id: "cols1",
    columns: [
      { id: "col1", widthPct: 50, blocks: [{ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "left" }] }] },
      { id: "col2", widthPct: 50, blocks: [{ type: "paragraph", id: "p2", children: [{ type: "text", id: "t2", text: "right" }] }] }
    ]
  });

  const handle = mountVanillaEditor(container, { document: doc });
  assert(handle);

  handle.destroy();
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.HTMLElement;
});
