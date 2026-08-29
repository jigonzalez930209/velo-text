import { JSDOM } from "jsdom";
import { createDocument, createIdGenerator, createHeading, createText, createParagraph, createTable, createImageBlock, createColumns } from "../../dist/core/model/factories.js";
import { createEditor } from "../../dist/editor-web/controller/index.js";
import { mountVanillaEditor } from "../../dist/adapters/vanilla.js";
import { findTextHits, replaceTextInDocument } from "../../dist/editor-web/ux/find-text.js";
import { renderBlocksToHtml } from "../../dist/editor-web/view/index.js";

function setup() {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="ed"></div></body>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Node = dom.window.Node;
  globalThis.Selection = dom.window.Selection;
  globalThis.Range = dom.window.Range;
  globalThis.NodeFilter = dom.window.NodeFilter;
  if (!dom.window.requestAnimationFrame) {
    dom.window.requestAnimationFrame = (fn) => { fn(0); return 0; };
  }
  if (!dom.window.HTMLElement.prototype.scrollIntoView) {
    dom.window.HTMLElement.prototype.scrollIntoView = function () { /* jsdom */ };
  }
  if (!dom.window.Range.prototype.getBoundingClientRect) {
    dom.window.Range.prototype.getBoundingClientRect = function () {
      return { left: 12, top: 20, right: 80, bottom: 36, width: 68, height: 16, x: 12, y: 20, toJSON() { return this; } };
    };
  }
  return { dom, el: dom.window.document.getElementById("ed") };
}
function teardown() {
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.Node;
  delete globalThis.Selection;
  delete globalThis.Range;
}

function docWith(g, extra) {
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  extra(doc);
  return doc;
}

test("ux: palette inserts H2 and table 3x2", async () => {
  const { el } = setup();
  const g = createIdGenerator("u");
  const doc = docWith(g, (d) => {
    d.root.children.push(createParagraph(g, [createText(g, "")]));
  });
  const editor = createEditor(el, { document: doc });
  editor.openCommandPalette();
  const pal = el.parentElement.querySelector(".pde-palette");
  assert(pal, "palette open");
  const labels = [...pal.querySelectorAll("button")].map((b) => b.textContent ?? "");
  assert(labels.includes("Heading 2"), labels.join(","));
  assert(labels.some((l) => l.includes("Table")), labels.join(","));
  const varBtn = [...pal.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes("Variable"));
  varBtn.click();
  assert(JSON.stringify(editor.getDocument()).includes('"path":"name"'));
  editor.commands.insertTable(2, 3);
  const table = editor.getDocument().root.children.find((b) => b.type === "table");
  assert(table && table.columns.length * table.rows.length === 6);
  editor.openCommandPalette();
  assert(el.parentElement.querySelector(".pde-palette"));
  el.ownerDocument.dispatchEvent(new el.ownerDocument.defaultView.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert(!el.parentElement.querySelector(".pde-palette"), "escape closes palette");
  editor.openCommandPalette();
  await new Promise((r) => setTimeout(r, 10));
  el.ownerDocument.body.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
  assert(!el.parentElement.querySelector(".pde-palette"), "outside pointer closes palette");
  editor.destroy();
  teardown();
});

test("ux: find replace then undo", () => {
  const { el } = setup();
  const g = createIdGenerator("f");
  const doc = docWith(g, (d) => {
    for (let i = 0; i < 5; i++) d.root.children.push(createParagraph(g, [createText(g, i < 3 ? "Item x" : "Other")]));
  });
  assert(findTextHits(doc, "Item").length === 3);
  const editor = createEditor(el, { document: doc });
  editor.openFind(true);
  const find = el.parentElement.querySelector(".pde-find");
  const q = find.querySelector("[data-q]");
  const r = find.querySelector("[data-repl]");
  q.value = "Item";
  q.dispatchEvent(new el.ownerDocument.defaultView.Event("input", { bubbles: true }));
  r.value = "Thing";
  find.querySelector("[data-one]").click();
  find.querySelector("[data-one]").click();
  find.querySelector("[data-one]").click();
  const texts = JSON.stringify(editor.getDocument());
  assert(texts.includes("Thing"));
  assert(!texts.includes('"Item x"') || (texts.match(/Thing/g) || []).length >= 3);
  editor.undo();
  editor.destroy();
  teardown();
});

test("ux: outline focus and page preview", () => {
  const { el } = setup();
  const g = createIdGenerator("o");
  const doc = docWith(g, (d) => {
    d.root.children.push(createHeading(g, 1, [createText(g, "A")]));
    d.root.children.push(createHeading(g, 2, [createText(g, "B")]));
    d.root.children.push(createHeading(g, 2, [createText(g, "C")]));
    d.root.children.push({ type: "page-break", id: g.next() });
    d.root.children.push(createHeading(g, 1, [createText(g, "D")]));
    d.root.children.push(createHeading(g, 2, [createText(g, "E")]));
    d.root.children.push(createHeading(g, 3, [createText(g, "F")]));
  });
  const editor = createEditor(el, { document: doc });
  const outline = editor.getOutline();
  assert(outline.length === 6);
  assert(editor.focusBlock(outline[2].id));
  editor.setPagePreview(true);
  assert(el.parentElement.classList.contains("pde-page-preview"));
  const before = JSON.stringify(editor.getDocument());
  editor.setPagePreview(false);
  assert(JSON.stringify(editor.getDocument()) === before);
  editor.destroy();
  teardown();
});

test("ux: no selection bubble inside table cell", () => {
  const { el, dom } = setup();
  const g = createIdGenerator("b");
  const doc = docWith(g, (d) => {
    const t = createTable(g, 2, 1);
    const p = t.rows[0].cells[0].blocks[0];
    if (p.type === "paragraph" && p.children[0].type === "text") p.children[0].text = "Widget";
    d.root.children.push(t);
  });
  const editor = createEditor(el, { document: doc });
  const p = el.querySelector("td p");
  const range = dom.window.document.createRange();
  range.selectNodeContents(p);
  const sel = dom.window.document.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  el.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));
  dom.window.document.dispatchEvent(new dom.window.Event("selectionchange"));
  assert(!el.parentElement.querySelector(".pde-sel-bubble"), "no text bubble inside table");
  editor.destroy();
  teardown();
});

test("ux: no selection bubble inside custom layout", () => {
  const { el, dom } = setup();
  const g = createIdGenerator("bc");
  const doc = docWith(g, (d) => {
    const cols = createColumns(g, 2);
    const p = cols.columns[0].blocks[0];
    if (p.type === "paragraph" && p.children[0].type === "text") p.children[0].text = "Slot";
    d.root.children.push(cols);
  });
  const editor = createEditor(el, { document: doc });
  const p = el.querySelector(".pde-column p");
  const range = dom.window.document.createRange();
  range.selectNodeContents(p);
  const sel = dom.window.document.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  el.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));
  dom.window.document.dispatchEvent(new dom.window.Event("selectionchange"));
  assert(!el.parentElement.querySelector(".pde-sel-bubble"), "no text bubble inside layout");
  editor.destroy();
  teardown();
});

test("ux: selection bubble on paragraph outside table", () => {
  const { el, dom } = setup();
  const g = createIdGenerator("bp");
  const doc = docWith(g, (d) => {
    d.root.children.push(createParagraph(g, [createText(g, "Hello world")]));
  });
  const editor = createEditor(el, { document: doc });
  const p = el.querySelector("p");
  const range = dom.window.document.createRange();
  range.selectNodeContents(p);
  const sel = dom.window.document.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  el.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));
  dom.window.document.dispatchEvent(new dom.window.Event("selectionchange"));
  const bubble = el.parentElement.querySelector(".pde-sel-bubble");
  assert(bubble, "bubble near selection");
  editor.destroy();
  teardown();
});

test("ux: replaceTextInDocument helper", () => {
  const g = createIdGenerator("r");
  const doc = docWith(g, (d) => {
    d.root.children.push(createParagraph(g, [createText(g, "Item Item")]));
  });
  const n = replaceTextInDocument(doc, "Item", "X", 1);
  assert(n === 1);
  assert(doc.root.children[0].children[0].text === "X Item");
});

test("ux: image alt box hides on outside click", () => {
  const { el } = setup();
  const g = createIdGenerator("im");
  const doc = docWith(g, (d) => {
    d.root.children.push({ type: "image", id: g.next(), assetId: "a1", widthUm: 40000, heightUm: 20000, alt: "x" });
  });
  const editor = createEditor(el, { document: doc });
  const figure = el.querySelector("figure[data-node-type='image']");
  const wrap = el.closest(".pde-editor-wrapper");
  figure.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true }));
  assert(wrap.querySelector(".pde-img-meta"), "alt/caption shown");
  el.ownerDocument.body.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("pointerdown", { bubbles: true }));
  assert(!wrap.querySelector(".pde-img-meta"), "alt/caption hidden");
  figure.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true }));
  assert(wrap.querySelector(".pde-img-meta"), "alt/caption shown again");
  el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true }));
  assert(!wrap.querySelector(".pde-img-meta"), "alt/caption hidden on editor click");
  editor.destroy();
  teardown();
});

test("ux: renderBlocksToHtml sets image src from resolver", () => {
  const g = createIdGenerator("img");
  const doc = docWith(g, (d) => {
    d.root.children.push({ type: "image", id: g.next(), assetId: "a1", widthUm: 40000, heightUm: 20000, alt: "chart" });
  });
  const html = renderBlocksToHtml(doc, (id) => id === "a1" ? "blob:preview-test" : undefined);
  assert(html.includes('src="blob:preview-test"'));
  assert(!renderBlocksToHtml(doc).includes("src="));
});

test("ux: drag image into table cell and column", () => {
  const { el } = setup();
  const g = createIdGenerator("mv");
  const img = createImageBlock(g, "a1", { alt: "pic", widthUm: 10000, heightUm: 8000 });
  const doc = docWith(g, (d) => {
    d.root.children.push(img);
    d.root.children.push(createTable(g, 1, 1));
    d.root.children.push(createColumns(g, 2));
  });
  const editor = createEditor(el, { document: doc });
  const dropAt = (host, id) => {
    const ev = new el.ownerDocument.defaultView.Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "dataTransfer", {
      value: { getData: (k) => k === "application/x-pde-block" ? id : "", files: [], types: ["application/x-pde-block"] },
    });
    host.dispatchEvent(ev);
  };
  const fig = el.querySelector("figure");
  const dt = {
    types: ["text/plain"],
    files: [],
    effectAllowed: "move",
    dropEffect: "move",
    setData() {},
    getData: () => "",
    setDragImage() {},
  };
  const start = new el.ownerDocument.defaultView.Event("dragstart", { bubbles: true, cancelable: true });
  Object.defineProperty(start, "dataTransfer", { value: dt });
  fig.dispatchEvent(start);
  dropAt(el.querySelector("table"), "");
  const afterTable = editor.getDocument();
  const table = afterTable.root.children.find((b) => b.type === "table");
  assert(table.rows[0].cells[0].blocks.some((b) => b.id === img.id), "image in cell via table");
  dropAt(el.querySelector(".pde-column"), img.id);
  const cols = editor.getDocument().root.children.find((b) => b.type === "columns");
  assert(cols.columns[0].blocks.some((b) => b.id === img.id), "image in column");
  editor.destroy();
  teardown();
});

test("ux: equation editor inserts latex", () => {
  const { el } = setup();
  const g = createIdGenerator("eq");
  const editor = createEditor(el, { document: docWith(g, (d) => {
    d.root.children.push(createParagraph(g, [createText(g, "")]));
  }) });
  editor.openEquationEditor({ latex: "E = mc^2", display: true });
  const dlg = el.parentElement.querySelector(".pde-eq-editor");
  assert(dlg, "equation dialog");
  assert(dlg.querySelectorAll("[data-cat]").length >= 8);
  const greek = [...dlg.querySelectorAll("[data-cat]")].find((b) => b.textContent === "Greek");
  greek.click();
  assert([...dlg.querySelectorAll(".pde-eq-snip")].some((b) => b.textContent === "Ω"));
  const mats = [...dlg.querySelectorAll("[data-cat]")].find((b) => b.textContent === "Matrices");
  mats.click();
  assert(dlg.querySelectorAll(".pde-eq-snip").length >= 4);
  dlg.querySelector("[data-insert]").click();
  const json = JSON.stringify(editor.getDocument());
  assert(json.includes("E = mc^2"));
  editor.destroy();
  teardown();
});

test("adapters: mountVanillaEditor destroy removes wrapper", () => {
  const { el } = setup();
  const g = createIdGenerator("v");
  const editor = mountVanillaEditor(el, { document: docWith(g, () => {}) });
  assert(el.parentElement.classList.contains("pde-editor-wrapper"));
  editor.destroy();
  assert(!el.ownerDocument.body.querySelector(".pde-editor-wrapper"));
  teardown();
});
