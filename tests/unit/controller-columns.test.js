/**
 * Columns chrome — click shows layout button; pointerdown does not steal caret.
 */
import { JSDOM } from "jsdom";
import { createDocument, createIdGenerator, createColumns } from "../../dist/core/model/factories.js";
import { createEditor } from "../../dist/editor-web/controller/index.js";

function setup() {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="ed"></div></body>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Node = dom.window.Node;
  globalThis.Range = dom.window.Range;
  globalThis.Selection = dom.window.Selection;
  return { dom, el: dom.window.document.getElementById("ed"), root: dom.window.document.body };
}
function teardown() {
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.Node;
  delete globalThis.Range;
  delete globalThis.Selection;
}

test("controller-columns: click shows chrome; inner pointerdown not prevented", () => {
  const { dom, el, root } = setup();
  const g = createIdGenerator("col");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push(createColumns(g, 2));
  createEditor(el, { document: doc });
  const layout = el.querySelector(".pde-columns");
  assert(layout, "columns rendered");
  layout.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  const bar = root.querySelector(".pde-columns-bar");
  assert(bar, "columns bar present");
  const p = layout.querySelector("p");
  const down = new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true });
  p.dispatchEvent(down);
  assert(down.defaultPrevented === false);
  teardown();
});

test("controller-columns: click shows gutter handles; mosaic inserts stacked rows", () => {
  const { dom, el, root } = setup();
  const g = createIdGenerator("col");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push(createColumns(g, 2));
  const editor = createEditor(el, { document: doc });
  const layout = el.querySelector(".pde-columns");
  layout.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  const gutters = root.querySelectorAll(".pde-gutter-handle");
  assert(gutters.length === 1, "two columns share one gutter");
  editor.commands.insertColumnMosaic([3, 2, 4]);
  const blocks = editor.getDocument().root.children.filter((b) => b.type === "columns");
  assert(blocks.length === 4);
  assert(blocks[1].columns.length === 3);
  assert(blocks[2].columns.length === 2);
  assert(blocks[3].columns.length === 4);
  teardown();
});

test("controller-columns: slot vertical align bottom", () => {
  const { dom, el, root } = setup();
  const g = createIdGenerator("col");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push(createColumns(g, 2));
  const editor = createEditor(el, { document: doc });
  const slot = el.querySelector(".pde-column");
  slot.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  root.querySelector('.pde-columns-bar button[aria-label="Cell alignment"]').click();
  const btn = Array.from(root.querySelectorAll(".pde-columns-menu button")).find((b) => b.getAttribute("aria-label") === "Align bottom");
  assert(btn, "align bottom in layout bar");
  btn.click();
  const layout = editor.getDocument().root.children[0];
  assert(layout.type === "columns");
  assert(layout.columns[0].vAlign === "bottom");
  editor.destroy();
  teardown();
});

test("controller-columns: insert row below stacks another layout", () => {
  const { dom, el, root } = setup();
  const g = createIdGenerator("colr");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push(createColumns(g, 2));
  const editor = createEditor(el, { document: doc });
  const slot = el.querySelector(".pde-column");
  slot.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  assert(el.querySelector('.pde-column[data-valign="top"]'), "default top");
  root.querySelector('.pde-columns-bar button[aria-label="Rows and columns"]').click();
  root.querySelector('button[aria-label="Insert row below"]').click();
  assert(editor.getDocument().root.children.filter((b) => b.type === "columns").length === 2);
  editor.destroy();
  teardown();
});
