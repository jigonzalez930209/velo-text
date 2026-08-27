/**
 * Editor controller tests — jsdom-based.
 * Verifies DOM↔AST sync, undo/redo, commands, theme and round-trip parsing.
 */
import { JSDOM } from "jsdom";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";
import { createEditor } from "../../dist/editor-web/controller/index.js";
import { domToAst } from "../../dist/editor-web/view/parse.js";
import { renderDocumentToHtml } from "../../dist/editor-web/view/index.js";

function setup() {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="ed"></div></body>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Node = dom.window.Node;
  globalThis.Selection = dom.window.Selection;
  globalThis.Range = dom.window.Range;
  const el = dom.window.document.getElementById("ed");
  return { dom, el };
}
function teardown() {
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.Node;
  delete globalThis.Selection;
  delete globalThis.Range;
}

function baseDoc() {
  const g = createIdGenerator("t");
  return createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
}

test("controller: renders initial document", () => {
  const { dom, el } = setup();
  const doc = baseDoc();
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "hello" }] });
  createEditor(el, { document: doc });
  assert(el.querySelector('[data-node-id="p1"]'));
  teardown();
});

test("controller: insertVariable + undo/redo", () => {
  const { dom, el } = setup();
  const doc = baseDoc();
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "hi" }] });
  const editor = createEditor(el, { document: doc });
  editor.commands.insertVariable("customer.name");
  const doc1 = editor.getDocument();
  const hasVar = JSON.stringify(doc1).includes('"path":"customer.name"');
  assert(hasVar, "variable should be in AST after insert");
  editor.undo();
  const doc2 = editor.getDocument();
  assert(!JSON.stringify(doc2).includes("customer.name"), "variable removed after undo");
  editor.redo();
  const doc3 = editor.getDocument();
  assert(JSON.stringify(doc3).includes("customer.name"), "variable restored after redo");
  teardown();
});

test("controller: insertTable / insertBlock / deleteCurrentBlock", () => {
  const { dom, el } = setup();
  const doc = baseDoc();
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "hi" }] });
  const editor = createEditor(el, { document: doc });
  editor.commands.insertTable(2, 2);
  assert(editor.getDocument().root.children.some((b) => b.type === "table"));
  editor.undo();
  assert(!editor.getDocument().root.children.some((b) => b.type === "table"));
  editor.commands.insertBlock("pageBreak");
  assert(editor.getDocument().root.children.some((b) => b.type === "page-break"));
  teardown();
});

test("controller: setTheme updates attribute", () => {
  const { dom, el } = setup();
  const editor = createEditor(el, { document: baseDoc(), theme: "light-neutral" });
  editor.setTheme("dark-slate");
  assert(el.getAttribute("data-pde-theme") === "dark-slate");
  assert(editor.getTheme() === "dark-slate");
  teardown();
});

test("controller: syncFromDom reflects typing (removed node stays removed)", () => {
  const { dom, el } = setup();
  const doc = baseDoc();
  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "hello " }, { type: "variable", id: "v1", path: "x", source: "{{x}}", valueType: "string" }] },
  );
  const editor = createEditor(el, { document: doc });
  // Remove the variable from DOM (as a user deleting it), then type
  const v = el.querySelector('[data-node-id="v1"]');
  v.remove();
  el.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true }));
  const afterDelete = editor.getDocument();
  assert(!JSON.stringify(afterDelete).includes("variable"), "variable removed from AST after DOM delete");
  // Type a letter into the paragraph
  const p = el.querySelector('[data-node-id="p1"]');
  p.appendChild(dom.window.document.createTextNode("a"));
  el.dispatchEvent(new dom.window.InputEvent("input", { bubbles: true }));
  const afterType = editor.getDocument();
  assert(!JSON.stringify(afterType).includes("variable"), "variable must NOT reappear after typing");
  assert(JSON.stringify(afterType).includes("a"), "typed text present in AST");
  teardown();
});

test("controller: domToAst round-trip preserves structure", () => {
  const { dom, el } = setup();
  const doc = baseDoc();
  doc.root.children.push(
    { type: "heading", id: "h1", level: 1, children: [{ type: "text", id: "ht", text: "Title" }] },
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "text " }, { type: "equation", id: "e1", latex: "E=mc^2" }] },
    { type: "list", id: "l1", kind: "unordered", items: [{ id: "li1", content: [{ type: "text", id: "lt", text: "item" }] }] },
    { type: "image", id: "im1", assetId: "a1", alt: "", widthUm: 100000, heightUm: 60000 },
  );
  const g = createIdGenerator("rt");
  const parsed = domToAst(el, doc, g);
  // Empty container -> empty children
  assert(parsed.root.children.length === 0);

  // Now render to DOM and parse back
  el.innerHTML = renderDocumentToHtml(doc).replace(/^<div[^>]*>/, "").replace(/<\/div>$/, "");
  const round = domToAst(el, doc, createIdGenerator("rt2"));
  assert(round.root.children.length === 4);
  const h = round.root.children[0];
  assert(h.type === "heading" && h.level === 1);
  const p = round.root.children[1];
  assert(p.type === "paragraph");
  assert(p.children.length === 2);
  const eq = p.children.find((c) => c.type === "equation");
  assert(eq && eq.latex === "E=mc^2");
  const list = round.root.children[2];
  assert(list.type === "list" && list.kind === "unordered");
  const img = round.root.children[3];
  assert(img.type === "image" && img.assetId === "a1");
  teardown();
});

test("controller: table round-trip with col widths and spans", () => {
  const { dom, el } = setup();
  const doc = baseDoc();
  doc.root.children.push({
    type: "table",
    id: "tbl",
    columns: [{ id: "c1", widthUm: 50000 }, { id: "c2", widthUm: 30000 }],
    rows: [
      { id: "r1", header: true, cells: [{ id: "a1", colSpan: 2, rowSpan: 1, blocks: [{ type: "paragraph", id: "pa1", children: [{ type: "text", id: "ta1", text: "hdr" }] }] }] },
      { id: "r2", cells: [{ id: "b1", colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: "pb1", children: [{ type: "text", id: "tb1", text: "c1" }] }] }, { id: "b2", colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: "pb2", children: [] }] }] },
    ],
  });
  el.innerHTML = renderDocumentToHtml(doc).replace(/^<div[^>]*>/, "").replace(/<\/div>$/, "");
  const round = domToAst(el, doc, createIdGenerator("rt3"));
  const tbl = round.root.children[0];
  assert(tbl.type === "table");
  const t = JSON.parse(JSON.stringify(tbl));
  assert(t.columns.length === 2);
  assert(t.rows[0].header === true);
  assert(t.rows[0].cells[0].colSpan === 2);
  assert(t.rows[1].cells.length === 2);
  teardown();
});

test("controller: destroy cleans up", () => {
  const { dom, el } = setup();
  const editor = createEditor(el, { document: baseDoc() });
  editor.destroy();
  // no-op render after destroy should not throw
  editor.commands.insertTable(2, 2);
  teardown();
});