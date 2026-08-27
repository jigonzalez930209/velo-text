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

test("dom input: pipeline", () => {
  const dom = setupDom('<div id="ed" contenteditable="true"></div>');
  const ed = dom.window.document.getElementById("ed");
  let intents = [];
  const off = attachInputPipeline(ed, { onIntent: (i) => intents.push(i) });
  // beforeinput insertText
  ed.dispatchEvent(new dom.window.InputEvent("beforeinput", { inputType: "insertText", data: "a", bubbles: true }));
  assert(intents.some((i) => i.type === "insertText"));
  // beforeinput deleteContentBackward
  ed.dispatchEvent(new dom.window.InputEvent("beforeinput", { inputType: "deleteContentBackward", bubbles: true }));
  assert(intents.some((i) => i.type === "deleteContentBackward"));
  // keydown Mod+b
  ed.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true }));
  assert(intents.some((i) => i.type === "toggleMark"));
  // Enter fallback (no beforeinput)
  ed.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert(intents.some((i) => i.type === "insertParagraph"));
  // composition
  ed.dispatchEvent(new dom.window.Event("compositionstart"));
  ed.dispatchEvent(new dom.window.CompositionEvent("compositionend", { data: "mañana" }));
  off();
  teardownDom();
});

// ── clipboard ──
test("dom clipboard: full", async () => {
  // handlePaste with internal fragment
  const frag = JSON.stringify({ type: "paragraph", children: [] });
  const p1 = handlePaste({ internalFragment: frag });
  assert(p1.isInternal);
  // invalid fragment
  const p2 = handlePaste({ internalFragment: "{bad" });
  assert(p2.diagnostics.some((d) => d.code === "invalid-internal-fragment"));
  // html + text
  const p3 = handlePaste({ html: "<p>hi</p><script>alert(1)</script>", text: "hi" });
  assert(!p3.sanitizedHtml.includes("script"));
  assert(p3.plainText === "hi");
  // large text
  const p4 = handlePaste({ text: "x".repeat(600000) });
  assert(p4.diagnostics.some((d) => d.code === "paste-too-large"));
  // sanitizeFileName
  assert(sanitizeFileName("../../evil.png") === "..._evil.png" || sanitizeFileName("a/b.png") === "a_b.png");
  assert(sanitizeFileName("ok.png") === "ok.png");
  // internal fragment helpers
  assert(parseInternalFragment(frag).type === "paragraph");
  let threw = false;
  try { createInternalFragment("x".repeat(2000000)); } catch { threw = true; }
  assert(threw);
  // images
  const setup = new JSDOM("", { url: "https://example.com" });
  const File = setup.window.File;
  const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const file = new File([png], "a.png", { type: "image/png" });
  // jsdom Blob may not expose arrayBuffer in this version — polyfill
  file.arrayBuffer = async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength);
  const imgs = await handleImageFiles([file]);
  assert(imgs.length === 1);
});

// ── tables ──
test("dom tables: full", () => {
  const g = idGen();
  const doc = createDocument({ idGenerator: g, clock });
  const tableId = g.next();
  doc.root.children.push({ type: "table", id: tableId, columns: [{ id: g.next(), widthUm: 10000 }, { id: g.next(), widthUm: 10000 }], rows: [{ id: g.next(), cells: [{ id: g.next(), colSpan: 1, rowSpan: 1, blocks: [] }, { id: g.next(), colSpan: 1, rowSpan: 1, blocks: [] }] }] });
  let d1 = insertRowAfter(doc, tableId, 0);
  assert(d1.root.children[0].rows.length === 2);
  d1 = deleteRow(d1, tableId, 1);
  assert(d1.root.children[0].rows.length === 1);
  d1 = insertColumnAfter(d1, tableId, 0);
  assert(d1.root.children[0].columns.length === 3);
  d1 = deleteColumn(d1, tableId, 1);
  assert(d1.root.children[0].columns.length === 2);
  // errors
  let threw = false;
  try { insertRowAfter(doc, "missing", 0); } catch { threw = true; }
  assert(threw);
  threw = false;
  try { deleteRow(doc, tableId, 5); } catch { threw = true; }
  assert(threw);
  threw = false;
  try { setCellSpan(doc, "missing", 0, 0, 1, 1); } catch { threw = true; }
  assert(threw);
  // cell selection
  const sel = createCellSelection(tableId, 0, 0);
  assert(extendCellSelection(sel, 0, 0).cells.length === 1);
  assert(extendCellSelection(sel, 0, 1).cells.length === 2);
  // getNextCell
  const tbl = doc.root.children[0];
  assert(getNextCell(tbl, 0, 1, "forward") === null);
  assert(getNextCell(tbl, 0, 0, "backward") === null);
  // handleTableTab at end creates row
  const tab = handleTableTab(doc, tableId, 0, 1, false);
  assert(tab.createdRow && tab.doc.root.children[0].rows.length === 2);
  // shift-tab at start
  const tab2 = handleTableTab(doc, tableId, 0, 0, true);
  assert(tab2.next === null);
  // span
  const sp = setCellSpan(doc, tableId, 0, 0, 2, 1);
  assert(sp.root.children[0].rows[0].cells[0].colSpan === 2);
});

// ── accessibility ──
test("dom a11y: full", () => {
  const dom = setupDom('<div id="tb" role="toolbar"><button>One</button><button>Two</button></div><div id="c"><span data-node-type="variable" contenteditable="false" data-node-id="v1">x</span></div>');
  const tb = dom.window.document.getElementById("tb");
  const off = makeToolbarNavigable(tb);
  const btns = tb.querySelectorAll("button");
  assert(btns[0].getAttribute("tabindex") === "0");
  // ArrowRight moves focus
  const ev = new dom.window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true });
  btns[0].dispatchEvent(ev);
  assert(dom.window.document.activeElement === btns[1]);
  // Home
  btns[1].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Home", bubbles: true }));
  assert(dom.window.document.activeElement === btns[0]);
  // Enter clicks
  let clicked = false;
  btns[0].onclick = () => { clicked = true; };
  btns[0].dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert(clicked);
  off();
  // announce
  const c = dom.window.document.getElementById("c");
  announce(c, "hello");
  assert(c.querySelector("[data-pde-live]"));
  // trapFreeNavigation: Delete on atomic (requires a selection anchored there)
  trapFreeNavigation(c);
  const atomic = c.querySelector("[data-node-type=\"variable\"]");
  const range = dom.window.document.createRange();
  range.setStart(atomic.firstChild, 0);
  range.collapse(true);
  const selW = dom.window.getSelection();
  selW.removeAllRanges();
  selW.addRange(range);
  const del = new dom.window.KeyboardEvent("keydown", { key: "Delete", bubbles: true });
  atomic.dispatchEvent(del);
  assert(!c.querySelector("[data-node-type=\"variable\"]"));
  // ensureAltText
  assert(ensureAltText("alt", false) === "alt");
  assert(ensureAltText(undefined, true) === "");
  let threw = false;
  try { ensureAltText(undefined, false); } catch { threw = true; }
  assert(threw);
  teardownDom();
});

// ── images ──
test("dom images: validate", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const v = validateImageBytes(png, "image/png");
  assert(v.valid);
  const bad = validateImageBytes(new Uint8Array([1, 2, 3]), "image/png");
  assert(!bad.valid);
  const big = validateImageBytes(new Uint8Array(10000001), "image/png", 1000);
  assert(!big.valid);
});