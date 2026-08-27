/**
 * Nested layouts: images/tables in cells and columns, presets, max depth 3.
 */
import { JSDOM } from "jsdom";
import { createDocument, createIdGenerator, createColumns, createTable, createImageBlock } from "../../dist/core/model/factories.js";
import { createEditor } from "../../dist/editor-web/controller/index.js";
import { applyWidths, MAX_LAYOUT_DEPTH, layoutDepthOf } from "../../dist/editor-web/controller/nesting.js";
import { COLUMN_PRESETS } from "../../dist/editor-web/controller/column-presets.js";
import { validateDocument } from "../../dist/core/schema/validator.js";
import { normalizeDocument } from "../../dist/core/normalize/normalize.js";

function setup() {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="ed"></div></body>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Node = dom.window.Node;
  const el = dom.window.document.getElementById("ed");
  return { dom, el };
}
function teardown() {
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.Node;
}

test("nested-layout: image and table inside columns", () => {
  const g = createIdGenerator("n");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  const cols = createColumns(g, [25, 50, 25]);
  cols.columns[0].blocks = [createImageBlock(g, "a1", { alt: "x", widthUm: 40000 })];
  cols.columns[1].blocks = [createTable(g, 2, 2)];
  doc.root.children.push(cols);
  doc.assets.a1 = { id: "a1", kind: "image", mediaType: "image/png", storageKey: "k", sha256: "a".repeat(64), byteLength: 1, alt: "x" };
  const { el } = setup();
  const editor = createEditor(el, { document: doc });
  assert(el.querySelector(".pde-columns"));
  assert(el.querySelector(".pde-column figure[data-node-type='image']"));
  assert(el.querySelector(".pde-column table.pde-table"));
  const live = editor.getDocument();
  assert(live.root.children[0].type === "columns");
  assert(live.root.children[0].columns[0].widthPct === 25);
  assert(live.root.children[0].columns[1].widthPct === 50);
  teardown();
});

test("nested-layout: presets keep content and change slot count", () => {
  const g = createIdGenerator("p");
  const node = createColumns(g, 2);
  node.columns[0].blocks[0] = { type: "paragraph", id: "keep", children: [{ type: "text", id: "t", text: "A" }] };
  applyWidths(node, [25, 50, 25], g);
  assert(node.columns.length === 3);
  assert(node.columns[0].blocks[0].id === "keep");
  applyWidths(node, [50, 50], g);
  assert(node.columns.length === 2);
  assert(COLUMN_PRESETS.some((x) => x.id === "25-50-25"));
});

test("nested-layout: depth 3 allowed, depth 4 rejected", () => {
  const g = createIdGenerator("d");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  const c1 = createColumns(g, 2);
  const t1 = createTable(g, 2, 1);
  const c2 = createColumns(g, 2);
  t1.rows[0].cells[0].blocks = [c2];
  c1.columns[0].blocks = [t1];
  doc.root.children.push(c1);
  const innerId = c2.columns[0].blocks[0].id;
  assert(layoutDepthOf(doc, innerId) === 3);
  assert(MAX_LAYOUT_DEPTH === 3);
  const ok = validateDocument(normalizeDocument(doc));
  assert(ok.valid, JSON.stringify(ok.errors));
  c2.columns[0].blocks.push(createTable(g, 2, 1));
  const bad = validateDocument(doc);
  assert(!bad.valid);
  assert(bad.errors.some((e) => e.code === "layout-depth"));
});
