/**
 * DOM coverage — drives editor-web DOM code with jsdom to reach >95% overall.
 * Each test sets up its own JSDOM instance and cleans globals afterward.
 */
import { JSDOM } from "jsdom";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";
import { renderDocumentToHtml, reconcileDom, attachMutationObserver, buildNodeMap, domSelectionToLogical, logicalToDomSelection } from "../../dist/editor-web/view/index.js";
import { attachInputPipeline, eventToShortcut, getIntentForShortcut, beforeInputToIntent, intentToOperation } from "../../dist/editor-web/input/index.js";
import { handlePaste, handleImageFiles, sanitizePastedHtml, getPlainTextFallback, createInternalFragment, parseInternalFragment, sanitizeFileName } from "../../dist/editor-web/clipboard/index.js";
import { insertRowAfter, deleteRow, insertColumnAfter, deleteColumn, getNextCell, handleTableTab, createCellSelection, extendCellSelection, setCellSpan } from "../../dist/editor-web/tables/index.js";
import { announce, makeToolbarNavigable, trapFreeNavigation, checkContrast, validateImageAlt, ariaLabelForVariable, ensureAltText } from "../../dist/editor-web/accessibility/index.js";
import { validateImageBytes } from "../../dist/editor-web/images/index.js";

const idGen = () => createIdGenerator("dom");
const clock = { nowIso: () => "2026-01-01T00:00:00.000Z" };

function setupDom(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.Node = dom.window.Node;
  globalThis.NodeFilter = dom.window.NodeFilter;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getSelection = () => dom.window.getSelection();
  return dom;
}
function teardownDom() {
  delete globalThis.document;
  delete globalThis.Node;
  delete globalThis.NodeFilter;
  delete globalThis.HTMLElement;
  delete globalThis.MutationObserver;
  delete globalThis.getSelection;
}

function sampleDoc() {
  const g = idGen();
  const doc = createDocument({ idGenerator: g, clock });
  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "hello " }, { type: "variable", id: "v1", path: "name", source: "{{name}}", valueType: "string" }] },
    { type: "equation-block", id: "eb1", latex: "a^2" },
  );
  return doc;
}

// ── view: renderDocumentToHtml all node types ──
test("dom view: render all node types", () => {
  const g = idGen();
  const doc = createDocument({ idGenerator: g, clock });
  doc.root.children.push(
    { type: "heading", id: g.next(), level: 2, children: [{ type: "text", id: g.next(), text: "H" }] },
    { type: "quote", id: g.next(), children: [{ type: "text", id: g.next(), text: "Q" }] },
    { type: "list", id: g.next(), kind: "ordered", items: [{ id: g.next(), content: [{ type: "text", id: g.next(), text: "a" }] }] },
    { type: "horizontal-rule", id: g.next() },
    { type: "page-break", id: g.next() },
  );
  doc.root.children.push({ type: "table", id: g.next(), columns: [{ id: g.next(), widthUm: 10000 }], rows: [{ id: g.next(), cells: [{ id: g.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: g.next(), children: [{ type: "text", id: g.next(), text: "cell" }] }] }] }] });
  doc.root.children.push({ type: "paragraph", id: g.next(), children: [
    { type: "text", id: g.next(), text: "b", marks: { bold: true, italic: true, underline: true, strike: true, code: true } },
    { type: "link", id: g.next(), href: "https://x.com", children: [{ type: "text", id: g.next(), text: "L" }] },
    { type: "inline-image", id: g.next(), assetId: "a1" },
    { type: "hard-break", id: g.next() },
    { type: "equation", id: g.next(), latex: "E=mc^2" },
  ] });
  doc.assets["a1"] = { id: "a1", kind: "image", mediaType: "image/png", storageKey: "k", sha256: "a".repeat(64), byteLength: 10, alt: "x" };
  const html = renderDocumentToHtml(doc);
  assert(html.includes("data-node-type=\"heading\""));
  assert(html.includes("data-node-type=\"equation\""));
  assert(html.includes("data-node-type=\"table\""));
  assert(html.includes("pde-page-break"));
  assert(html.includes("role=\"math\""));
});

// ── view: reconcileDom paths ──
test("dom view: reconcileDom composing + focus + observer", () => {
  const dom = setupDom('<div id="root"></div>');
  const container = dom.window.document.getElementById("root");
  const doc = sampleDoc();
  container.innerHTML = renderDocumentToHtml(doc).replace(/^<div[^>]*>/, "").replace(/<\/div>$/, "");

  // Composing defers reconciliation
  container._pdeComposing = true;
  reconcileDom(null, doc, container);
  assert(container._pdeComposing === true);
  // Dispatch compositionend to trigger deferred reconcile
  const evt = new dom.window.Event("compositionend");
  container.dispatchEvent(evt);
  assert(container._pdeComposing === false);
  assert(container.getAttribute("aria-busy") === "false");

  // hadFocus path -> container.focus()
  const sel = dom.window.getSelection();
  const p = container.querySelector("[data-node-id=\"p1\"]");
  const r = dom.window.document.createRange();
  r.selectNodeContents(p);
  sel.removeAllRanges();
  sel.addRange(r);
  reconcileDom(doc, doc, container);
  assert(container.getAttribute("aria-busy") === "false");

  // buildNodeMap
  const map = buildNodeMap(container);
  assert(map.has("p1") && map.has("v1"));

  // MutationObserver: pending suppresses recovery
  const observer = attachMutationObserver(container, () => doc, () => {});
  container._pdeSetPending(true);
  p.textContent = "mutated";
  container._pdeSetPending(false);
  teardownDom();
  observer.disconnect();
});

// ── view: domSelectionToLogical / logicalToDomSelection ──
test("dom view: selection mapping", () => {
  const dom = setupDom('<div id="root"></div>');
  const container = dom.window.document.getElementById("root");
  const doc = sampleDoc();
  container.innerHTML = renderDocumentToHtml(doc).replace(/^<div[^>]*>/, "").replace(/<\/div>$/, "");
  const sel = dom.window.getSelection();

  // No selection -> null
  assert(domSelectionToLogical(container) === null);

  // Text node selection — text nodes are raw text inside <p>, no wrapper element
  const pEl = container.querySelector("[data-node-id=\"p1\"]");
  const textNode = Array.from(pEl.childNodes).find((n) => n.nodeType === dom.window.Node.TEXT_NODE);
  const r = dom.window.document.createRange();
  r.setStart(textNode, 1);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
  const logical = domSelectionToLogical(container);
  assert(logical && logical.nodeId === "p1");

  // Atomic node selection (variable)
  const v = container.querySelector("[data-node-id=\"v1\"]");
  const r2 = dom.window.document.createRange();
  r2.selectNode(v);
  sel.removeAllRanges();
  sel.addRange(r2);
  const logical2 = domSelectionToLogical(container);
  assert(logical2 && logical2.nodeId === "v1");
  assert(logical2.offset === 1);

  // logicalToDomSelection: atomic
  logicalToDomSelection(container, "v1", 1);
  assert(sel.rangeCount === 1);
  // logicalToDomSelection: text node
  logicalToDomSelection(container, "p1", 3);
  assert(sel.rangeCount === 1);
  // missing node -> no-op
  logicalToDomSelection(container, "missing", 0);
  assert(sel.rangeCount === 1);
  teardownDom();
});

// ── input: intentToOperation all intents ──
test("dom input: intentToOperation", () => {
  const g = idGen();
  const doc = createDocument({ idGenerator: g, clock });
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "x" }] });
  const out1 = intentToOperation(doc, { type: "insertText", text: "hi" }, "p1", 0);
  assert(out1.root.children[0].children.length === 2);
  const out2 = intentToOperation(doc, { type: "insertVariable", path: "a" }, "p1", 0);
  assert(out2.root.children[0].children[0].type === "variable");
  const out3 = intentToOperation(doc, { type: "insertEquation", latex: "E=mc^2" }, "p1", 0);
  assert(out3.root.children[0].children[0].type === "equation");
  const out4 = intentToOperation(doc, { type: "insertBlockEquation", latex: "x=y" }, "p1", 0);
  assert(out4.root.children.length === 2);
  // insertTable intent is not implemented as an operation (handled by table module)
  const out5 = intentToOperation(doc, { type: "insertTable", rows: 2, cols: 2 }, "p1", 0);
  assert(out5.root.children.length === 1);
});

// ── input: pipeline & shortcuts ──
