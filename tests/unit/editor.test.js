import { eventToShortcut, getIntentForShortcut, beforeInputToIntent } from "../../dist/editor-web/input/index.js";
import { getNextCell, handleTableTab, createCellSelection, extendCellSelection, setCellSpan } from "../../dist/editor-web/tables/index.js";
import { sanitizePastedHtml, getPlainTextFallback, PASTE_LIMIT_BYTES } from "../../dist/editor-web/clipboard/index.js";
import { checkContrast, validateImageAlt, ariaLabelForVariable } from "../../dist/editor-web/accessibility/index.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

// Input: shortcuts
test("input: eventToShortcut maps Mod+b", () => {
  const e = { key: "b", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };
  // Force non-Mac via defineProperty (navigator is read-only in Node 22)
  const origDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  try {
    Object.defineProperty(globalThis, "navigator", { value: { platform: "Win32" }, configurable: true, writable: true });
    const s = eventToShortcut(e);
    assert.equal(s, "Mod+b");
  } finally {
    if (origDesc) Object.defineProperty(globalThis, "navigator", origDesc);
    else delete globalThis.navigator;
  }
});

test("input: getIntentForShortcut finds bold", () => {
  const e = { key: "b", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false };
  const origDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  try {
    Object.defineProperty(globalThis, "navigator", { value: { platform: "Win32" }, configurable: true, writable: true });
    const intent = getIntentForShortcut(e);
    assert(intent !== null && intent.type === "toggleMark" && intent.mark === "bold");
  } finally {
    if (origDesc) Object.defineProperty(globalThis, "navigator", origDesc);
    else delete globalThis.navigator;
  }
});

test("input: beforeInputToIntent parses insertText", () => {
  const e = { inputType: "insertText", data: "hello" };
  const intent = beforeInputToIntent(e);
  assert(intent && intent.type === "insertText" && intent.text === "hello");
});

test("input: beforeInputToIntent deleteContentBackward", () => {
  const intent = beforeInputToIntent({ inputType: "deleteContentBackward" });
  assert(intent && intent.type === "deleteContentBackward");
});

// Tables
test("tables: getNextCell forward wraps", () => {
  const table = { columns: [{ id: "c1" }, { id: "c2" }], rows: [{ id: "r1" }, { id: "r2" }] };
  const next = getNextCell(table, 0, 1, "forward");
  assert(next && next.row === 1 && next.col === 0 && next.wrap);
});

test("tables: getNextCell backward", () => {
  const table = { columns: [{ id: "c1" }, { id: "c2" }], rows: [{ id: "r1" }, { id: "r2" }] };
  const next = getNextCell(table, 1, 0, "backward");
  assert(next && next.row === 0 && next.col === 1);
});

test("tables: handleTableTab creates row at end", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push({
    type: "table",
    id: "tbl",
    columns: [{ id: "c1", widthUm: 40000 }, { id: "c2", widthUm: 40000 }],
    rows: [
      { id: "r1", cells: [{ id: "a1", colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "a" }] }] }, { id: "a2", colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: "p2", children: [{ type: "text", id: "t2", text: "b" }] }] }] },
    ],
  });
  const res = handleTableTab(doc, "tbl", 0, 1, false);
  assert(res.createdRow);
  assert.equal(res.doc.root.children[0].rows.length, 2);
});

test("tables: cell selection extend", () => {
  const sel = createCellSelection("tbl", 0, 0);
  const ext = extendCellSelection(sel, 0, 1);
  assert.equal(ext.cells.length, 2);
});

test("tables: setCellSpan", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push({
    type: "table",
    id: "tbl",
    columns: [{ id: "c1", widthUm: 40000 }, { id: "c2", widthUm: 40000 }],
    rows: [{ id: "r1", cells: [{ id: "a1", colSpan: 1, rowSpan: 1, blocks: [] }, { id: "a2", colSpan: 1, rowSpan: 1, blocks: [] }] }],
  });
  const next = setCellSpan(doc, "tbl", 0, 0, 2, 1);
  assert.equal(next.root.children[0].rows[0].cells[0].colSpan, 2);
});

// Clipboard
test("clipboard: sanitize strips script and javascript url", () => {
  const html = '<p>hello<script>alert(1)</script><a href="javascript:evil()">click</a></p>';
  const out = sanitizePastedHtml(html);
  assert(!out.includes("<script"));
  assert(!out.includes("javascript:"));
});

test("clipboard: getPlainTextFallback strips tags", () => {
  const t = getPlainTextFallback("<p>hello <b>world</b></p>");
  assert.equal(t, "hello world");
});

test("clipboard: PASTE_LIMIT_BYTES defined", () => {
  assert(PASTE_LIMIT_BYTES === 1_000_000);
});

// Accessibility
test("a11y: ariaLabelForVariable", () => {
  assert.equal(ariaLabelForVariable("customer.name"), "Variable customer.name");
});

test("a11y: validateImageAlt requires alt", () => {
  const r = validateImageAlt(undefined, false);
  assert(!r.valid);
  const r2 = validateImageAlt("logo", false);
  assert(r2.valid);
  const r3 = validateImageAlt(undefined, true);
  assert(r3.valid);
});

test("a11y: checkContrast passes for black/white", () => {
  const c = checkContrast("#000000", "#ffffff");
  assert(c.ratio > 15);
  assert(c.passesAA);
});

test("a11y: checkContrast fails for low contrast", () => {
  const c = checkContrast("#777777", "#888888");
  assert(!c.passesAA);
});
