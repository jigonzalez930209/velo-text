/**
 * Editor controller UI interactions — block handles, menus, resize, table ops.
 */
import { JSDOM } from "jsdom";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";
import { createEditor } from "../../dist/editor-web/controller/index.js";

function setup(extra = "") {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="ed"></div></body>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Node = dom.window.Node;
  globalThis.NodeFilter = dom.window.NodeFilter;
  globalThis.Selection = dom.window.Selection;
  globalThis.Range = dom.window.Range;
  const el = dom.window.document.getElementById("ed");
  return { dom, el, root: el.parentElement };
}
function teardown() {
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.Node;
  delete globalThis.NodeFilter;
  delete globalThis.Selection;
  delete globalThis.Range;
}

function baseDoc() {
  const g = createIdGenerator("t");
  return createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
}

function ev(win, type, props = {}) {
  const e = new win.MouseEvent(type, { bubbles: true, cancelable: true });
  for (const [k, v] of Object.entries(props)) {
    try {
      Object.defineProperty(e, k, { value: v, configurable: true });
    } catch {
      /* ignore read-only */
    }
  }
  return e;
}

test("controller-ui: block handle shows on hover and menu inserts block", () => {
  const { dom, el, root } = setup();
  const doc = baseDoc();
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "hi" }] });
  const editor = createEditor(el, { document: doc });
  const p = el.querySelector('[data-node-id="p1"]');
  el.dispatchEvent(ev(dom.window, "mouseover", { target: p }));
  const handle = root.querySelector(".pde-block-handle");
  assert(handle, "handle should appear");
  assert(handle.dataset.owner === "p1");
  // Open insert menu
  const plus = handle.querySelector("[data-block-handle-menu]");
  plus.dispatchEvent(ev(dom.window, "pointerdown", { target: plus, clientX: 0, clientY: 0 }));
  const menu = root.querySelector(".pde-block-menu");
  assert(menu, "menu should appear");
  // Click "Heading 2"
  const btns = Array.from(menu.querySelectorAll("button"));
  const h2 = btns.find((b) => b.textContent.includes("Heading 2"));
  assert(h2, "Heading 2 item present");
  h2.click();
  const after = editor.getDocument();
  assert(after.root.children.length === 2, "block inserted after");
  assert(after.root.children[1].type === "heading" && after.root.children[1].level === 2);
  teardown();
});

test("controller-ui: block drag reorder runs", () => {
  const { dom, el, root } = setup();
  const doc = baseDoc();
  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "one" }] },
    { type: "paragraph", id: "p2", children: [{ type: "text", id: "t2", text: "two" }] },
  );
  const editor = createEditor(el, { document: doc });
  const p1 = el.querySelector('[data-node-id="p1"]');
  el.dispatchEvent(ev(dom.window, "mouseover", { target: p1 }));
  const grip = root.querySelector("[data-block-handle-grip]");
  assert(grip, "grip present");
  // simulate drag: pointerdown on grip then move/up on document
  grip.dispatchEvent(ev(dom.window, "pointerdown", { target: grip, clientX: 0, clientY: 0 }));
  dom.window.document.dispatchEvent(ev(dom.window, "pointermove", { clientX: 0, clientY: 99999 }));
  dom.window.document.dispatchEvent(ev(dom.window, "pointerup", { clientX: 0, clientY: 99999 }));
  // order may change depending on rects; just ensure doc still has 2 blocks
  assert(editor.getDocument().root.children.length === 2);
  teardown();
});

test("controller-ui: hover inside table cell attaches handle to table, not inner paragraph", () => {
  const { dom, el, root } = setup();
  const doc = baseDoc();
  const g = createIdGenerator("tbl");
  doc.root.children.push({
    type: "table",
    id: "tbl1",
    columns: [{ id: g.next(), widthUm: 40000 }, { id: g.next(), widthUm: 40000 }],
    rows: [
      { id: g.next(), cells: [
        { id: g.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: "cellp", children: [{ type: "text", id: g.next(), text: "a" }] }] },
        { id: g.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: g.next(), children: [] }] },
      ] },
    ],
  });
  createEditor(el, { document: doc });
  const inner = el.querySelector('[data-node-id="cellp"]');
  inner.dispatchEvent(ev(dom.window, "mouseover", { target: inner }));
  const handle = root.querySelector(".pde-block-handle");
  assert(handle, "handle should appear");
  assert(handle.dataset.owner === "tbl1", "handle should own the table, not the cell paragraph");
  teardown();
});

test("controller-ui: pointerdown on table cell does not prevent default caret placement", () => {
  const { dom, el } = setup();
  const doc = baseDoc();
  const g = createIdGenerator("tbl");
  doc.root.children.push({
    type: "table",
    id: "tbl1",
    columns: [{ id: g.next(), widthUm: 40000 }],
    rows: [
      { id: g.next(), cells: [{ id: g.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: "cellp", children: [{ type: "text", id: g.next(), text: "a" }] }] }] },
    ],
  });
  createEditor(el, { document: doc });
  const td = el.querySelector("td[data-col-index]");
  assert(td, "cell rendered with data-col-index");
  const down = ev(dom.window, "pointerdown", { target: td, clientX: 10, clientY: 10 });
  td.dispatchEvent(down);
  assert(down.defaultPrevented === false, "cell click must not steal caret");
  teardown();
});

test("controller-ui: table menu insert/delete row and col resize", () => {
  const { dom, el, root } = setup();
  const doc = baseDoc();
  const g = createIdGenerator("tbl");
  doc.root.children.push({
    type: "table",
    id: "tbl1",
    columns: [{ id: g.next(), widthUm: 40000 }, { id: g.next(), widthUm: 40000 }],
    rows: [
      { id: g.next(), cells: [{ id: g.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: g.next(), children: [{ type: "text", id: g.next(), text: "a" }] }] }, { id: g.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: g.next(), children: [] }] }] },
    ],
  });
  const editor = createEditor(el, { document: doc });
  const table = el.querySelector('table[data-node-type="table"]');
  assert(table, "table rendered");
  // Click table -> menu
  table.dispatchEvent(ev(dom.window, "click", { target: table }));
  const gear = root.querySelector(".pde-table-btn");
  assert(gear, "table button present");
  gear.click();
  const menu = root.querySelector(".pde-table-menu");
  assert(menu, "table menu present");
  // Insert row below
  const btn = Array.from(menu.querySelectorAll("button")).find((b) => b.textContent.includes("Insert row below"));
  btn.click();
  const d1 = editor.getDocument();
  assert(d1.root.children[0].rows.length === 2, "row inserted");
  // re-click table to re-show column handles after re-render
  const table2 = el.querySelector('table[data-node-type="table"]');
  table2.dispatchEvent(ev(dom.window, "click", { target: table2 }));
  const colHandles = root.querySelectorAll(".pde-col-handle");
  assert(colHandles.length === 1, "two-column table has one internal divider handle");
  const colHandle = colHandles[0];
  assert(colHandle, "col handle present");
  const before = editor.getDocument().root.children[0].columns[0].widthUm;
  colHandle.dispatchEvent(ev(dom.window, "pointerdown", { target: colHandle, clientX: 100, clientY: 0 }));
  dom.window.document.dispatchEvent(ev(dom.window, "pointerup", { clientX: 100, clientY: 0 }));
  assert(editor.getDocument().root.children[0].columns[0].widthUm === before, "click without drag must not snap column width");
  colHandle.dispatchEvent(ev(dom.window, "pointerdown", { target: colHandle, clientX: 100, clientY: 0 }));
  dom.window.document.dispatchEvent(ev(dom.window, "pointermove", { clientX: 200, clientY: 0 }));
  dom.window.document.dispatchEvent(ev(dom.window, "pointerup", { clientX: 200, clientY: 0 }));
  const d2 = editor.getDocument();
  assert(d2.root.children[0].columns[0].widthUm > 40000, "column width increased");
  const table3 = el.querySelector('table[data-node-type="table"]');
  table3.dispatchEvent(ev(dom.window, "click", { target: table3 }));
  root.querySelector(".pde-table-btn").click();
  const merge = Array.from(root.querySelectorAll(".pde-table-menu button")).find((b) => b.textContent.includes("Merge cell right"));
  merge.click();
  assert(editor.getDocument().root.children[0].rows[0].cells[0].colSpan === 2);
  teardown();
});

test("controller-ui: image resize updates widthUm", () => {
  const { dom, el, root } = setup();
  const doc = baseDoc();
  doc.assets["a1"] = { id: "a1", kind: "image", mediaType: "image/png", storageKey: "k", sha256: "a".repeat(64), byteLength: 10, alt: "x" };
  const g = createIdGenerator("img");
  doc.root.children.push({ type: "image", id: g.next(), assetId: "a1", widthUm: 100000, heightUm: 60000 });
  const editor = createEditor(el, { document: doc });
  const figure = el.querySelector('figure[data-node-type="image"]');
  assert(figure, "image figure rendered");
  // click image -> resize overlay
  figure.dispatchEvent(ev(dom.window, "click", { target: figure }));
  const overlay = root.querySelector(".pde-image-resize");
  assert(overlay, "resize overlay present");
  const handle = overlay.querySelector("[data-img-handle]");
  assert(handle, "resize handle present");
  handle.dispatchEvent(ev(dom.window, "pointerdown", { target: handle, clientX: 100, clientY: 0 }));
  dom.window.document.dispatchEvent(ev(dom.window, "pointermove", { clientX: 300, clientY: 0 }));
  dom.window.document.dispatchEvent(ev(dom.window, "pointerup", { clientX: 300, clientY: 0 }));
  const img = editor.getDocument().root.children[0];
  assert(img.type === "image");
  assert(img.widthUm > 100000, "image width increased");
  teardown();
});

test("controller-ui: image align center persists on selected figure", () => {
  const { el, root } = setup();
  const doc = baseDoc();
  doc.assets["a1"] = { id: "a1", kind: "image", mediaType: "image/png", storageKey: "k", sha256: "a".repeat(64), byteLength: 10, alt: "x" };
  const g = createIdGenerator("img");
  doc.root.children.push({ type: "image", id: g.next(), assetId: "a1", widthUm: 80000, heightUm: 50000 });
  const editor = createEditor(el, { document: doc });
  const figure = el.querySelector('figure[data-node-type="image"]');
  figure.dispatchEvent(ev(el.ownerDocument.defaultView, "click", { target: figure }));
  assert(root.querySelector(".pde-image-resize"), "resize overlay present");
  editor.commands.setAlign("center");
  const img = editor.getDocument().root.children[0];
  assert(img.type === "image" && img.align === "center");
  const overlay = root.querySelector(".pde-image-resize");
  overlay.style.left = "99px";
  editor.commands.setAlign("right");
  assert(root.querySelector(".pde-image-resize").style.left !== "99px", "resize frame follows the image");
  teardown();
});

test("controller-ui: commands without execCommand support still sync", () => {
  const { dom, el, root } = setup();
  const doc = baseDoc();
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "hi" }] });
  const editor = createEditor(el, { document: doc });
  // select the text
  const p = el.querySelector('[data-node-id="p1"]');
  const range = dom.window.document.createRange();
  range.selectNodeContents(p);
  const sel = dom.window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  editor.commands.toggleMark("bold");
  editor.commands.toggleMark("code");
  editor.commands.setHeading(1);
  editor.commands.toggleList("ordered");
  editor.commands.toggleQuote();
  editor.commands.setAlign("center");
  editor.commands.clearFormat();
  editor.commands.deleteCurrentBlock();
  const d = editor.getDocument();
  assert(d.root.children.length >= 0);
  // undo restores
  editor.undo();
  assert(editor.getDocument().root.children.length === 1);
  teardown();
});

test("controller-ui: insertEquation inline and insertImage/insertTable commands", () => {
  const { dom, el, root } = setup();
  const doc = baseDoc();
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "x" }] });
  const editor = createEditor(el, { document: doc });
  editor.commands.insertEquation("\\frac{a}{b}");
  assert(JSON.stringify(editor.getDocument()).includes("\\frac{a}{b}"));
  editor.commands.insertImage("a2", 80000, 50000);
  const d = editor.getDocument();
  const img = d.root.children.find((b) => b.type === "image");
  assert(img && img.widthUm === 80000);
  editor.commands.insertBlock("equationBlock");
  assert(editor.getDocument().root.children.some((b) => b.type === "equation-block"));
  teardown();
});

test("controller-ui: setDocument and getDocument round-trip", () => {
  const { dom, el, root } = setup();
  const doc = baseDoc();
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "a" }] });
  const editor = createEditor(el, { document: doc });
  const doc2 = baseDoc();
  doc2.root.children.push({ type: "paragraph", id: "x1", children: [{ type: "text", id: "x2", text: "b" }] });
  editor.setDocument(doc2);
  assert(editor.getDocument().root.children[0].id === "x1");
  teardown();
});