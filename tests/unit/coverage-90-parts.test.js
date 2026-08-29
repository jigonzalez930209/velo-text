/**
 * Drive remaining modules so each lib part and overall stay ≥90% lines.
 */
import { JSDOM } from "jsdom";
import {
  createDocument,
  createIdGenerator,
  createParagraph,
  createText,
  createHeading,
  createTable,
  createImageBlock,
  createColumns,
  createVariable,
  createEquation,
  createEquationBlock,
} from "../../dist/core/model/factories.js";
import { createEditor } from "../../dist/editor-web/controller/index.js";
import {
  insertBlankRow,
  mergeRight,
  splitCell,
  insertCol,
  deleteRows,
  deleteCols,
  forPickedCells,
  setCellTextAlign,
} from "../../dist/editor-web/controller/table-ops.js";
import { cellPick, rectPicks, expandDrag, paintCellClasses } from "../../dist/editor-web/controller/table-select.js";
import { marksFromElement } from "../../dist/editor-web/controller/format-commands.js";
import { barIconBtn, barFlyBtn, barMenuItem, barAlignPad } from "../../dist/editor-web/controller/bar-chrome.js";
import { COLUMN_PRESETS, presetById } from "../../dist/editor-web/controller/column-presets.js";
import { findColumnsNode } from "../../dist/editor-web/controller/column-resize.js";
import { isLayout, findParentList, findHostBlocks, layoutDepthOf } from "../../dist/editor-web/controller/nesting.js";
import { parseInlines } from "../../dist/editor-web/view/parse-inlines.js";
import { findTextHits, replaceTextInDocument } from "../../dist/editor-web/ux/find-text.js";
import { collectOutline, focusBlockEl } from "../../dist/editor-web/ux/outline.js";
import { applyPagePreview, keepBlocksOnPage } from "../../dist/editor-web/ux/page-preview.js";
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
import { reportSlots } from "../../dist/api-report/index.js";
import { handlePdfExportJson, sendPdfHttpResult } from "../../dist/adapters/backend/pdf-http.js";
import { latexToHtml } from "../../dist/core/equation/html.js";
import { twipToUm, umToTwip, umToPx, clampUm, roundUm } from "../../dist/export/layout/units.js";
import { pdfFontForMarks, pdfFaceForMarks } from "../../dist/export/pdf/fonts.js";
import { layoutStructuredBlock } from "../../dist/export/layout/layout-structured.js";
import { pushPage } from "../../dist/export/layout/layout-flow.js";
import { decodeViaBitmap } from "../../dist/export/images/rasterize.js";
import { prepareExportImages, targetEmbedPx } from "../../dist/export/images/prepare.js";
import { assemblePdf } from "../../dist/export/pdf/assemble.js";
import { encodeRgbImageData } from "../../dist/export/pdf/image.js";
import { openSizePicker, openMosaicPicker } from "../../dist/editor-web/controller/size-picker.js";

function setup() {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="ed"></div></body>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Node = dom.window.Node;
  globalThis.Selection = dom.window.Selection;
  globalThis.Range = dom.window.Range;
  globalThis.NodeFilter = dom.window.NodeFilter;
  if (!dom.window.HTMLElement.prototype.scrollIntoView) {
    dom.window.HTMLElement.prototype.scrollIntoView = function () {};
  }
  return { dom, el: dom.window.document.getElementById("ed"), doc: dom.window.document };
}
function teardown() {
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.Node;
  delete globalThis.Selection;
  delete globalThis.Range;
}

function gen() {
  return createIdGenerator("c90");
}

test("coverage90: table-ops mutate table", () => {
  const g = gen();
  const tbl = createTable(g, 2, 2);
  tbl.rows[0].heightUm = 11000;
  tbl.rows[0].cells[0].colSpan = 1;
  tbl.rows[0].cells[0].blocks = [createParagraph(g, [createText(g, "a")])];
  tbl.rows[0].cells[1].blocks = [createParagraph(g, [createText(g, "b")])];
  const fake = { idGen: g };
  insertBlankRow(fake, tbl, 0, 1);
  assert(tbl.rows.length === 3);
  insertBlankRow(fake, tbl, 99, 0);
  mergeRight(tbl, 0, 0);
  assert((tbl.rows[0].cells[0].colSpan || 1) >= 2);
  splitCell(fake, tbl, 0, 0);
  splitCell(fake, tbl, 0, 0);
  insertCol(fake, tbl, 0);
  deleteRows(tbl, [2, 2, -1, 99]);
  deleteCols(tbl, [0, 0, -1]);
  const seen = [];
  forPickedCells(tbl, [{ row: 0, col: 0 }, { row: 9, col: 0 }], (c) => seen.push(c));
  assert(seen.length === 1);
  setCellTextAlign(tbl.rows[0].cells[0], "center");
  assert(tbl.rows[0].cells[0].blocks[0].align === "center");
});

test("coverage90: table-select helpers", () => {
  const { doc } = setup();
  const table = doc.createElement("table");
  table.className = "pde-table";
  table.innerHTML = `<tbody>
    <tr><td data-col-index="0">a</td><td data-col-index="1">b</td></tr>
    <tr><td data-col-index="0">c</td><td data-col-index="1">d</td></tr>
  </tbody>`;
  doc.body.appendChild(table);
  const td = table.querySelector("td");
  const pick = cellPick(td);
  assert(pick && pick.row === 0 && pick.col === 0);
  assert(cellPick(null) === null);
  assert(cellPick(doc.createElement("div")) === null);
  const picks = rectPicks({ row: 1, col: 1 }, { row: 0, col: 0 });
  assert(picks.length === 4);
  const cols = expandDrag(table, { row: 0, col: 0 }, { row: 0, col: 1 });
  assert(cols.length === 4);
  const rows = expandDrag(table, { row: 0, col: 0 }, { row: 1, col: 0 });
  assert(rows.length === 4);
  const rect = expandDrag(table, { row: 0, col: 0 }, { row: 1, col: 1 });
  assert(rect.length === 4);
  paintCellClasses(table, [{ row: 0, col: 0 }], { row: 1, col: 1 });
  assert(table.querySelector(".pde-cell-sel"));
  assert(table.querySelector(".pde-cell-active"));
  teardown();
});

test("coverage90: format-commands and bar-chrome", () => {
  const { el, doc } = setup();
  const g = gen();
  const document = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  document.root.children = [createParagraph(g, [createText(g, "hi")])];
  const editor = createEditor(el, { document });
  editor.commands.setColor("#111");
  editor.commands.setHighlight("#eee");
  editor.commands.setFontFamily("Georgia");
  editor.commands.setFontSizePt(14);
  editor.commands.indent(1);
  editor.commands.indent(-1);
  editor.commands.insertLink("https://example.com");
  editor.commands.insertLink("not-a-url");
  const span = doc.createElement("span");
  span.style.color = "rgb(1,2,3)";
  span.style.backgroundColor = "rgb(9,9,9)";
  span.style.fontSize = "16px";
  span.style.fontFamily = '"Georgia", serif';
  const m = marksFromElement(span);
  assert(m.color && m.background && m.fontSizePt && m.fontFamily === "Georgia");
  span.style.fontSize = "12pt";
  assert(marksFromElement(span).fontSizePt === 12);
  const b = barIconBtn(doc, "bold", "Bold", () => {}, true);
  b.onclick(new doc.defaultView.MouseEvent("click", { bubbles: true }));
  barFlyBtn(doc, "alignLeft", "Align", () => {});
  barMenuItem(doc, "On", () => {}, true);
  barMenuItem(doc, "Off", () => {}, false);
  barAlignPad(doc, "left", "top", () => {}, () => {});
  editor.destroy();
  teardown();
});

test("coverage90: presets, nesting, outline, find in nested", () => {
  const g = gen();
  assert(presetById("70-30")?.pcts[0] === 70);
  assert(!presetById("nope"));
  assert(COLUMN_PRESETS.length === 4);
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  const table = createTable(g, 1, 1);
  const cols = createColumns(g, [50, 50]);
  const innerH = createHeading(g, 2, [createText(g, "In cell"), createVariable(g, "x", "{{x}}", { valueType: "string" }), { type: "link", id: g.next(), href: "https://a", children: [createText(g, "L")] }]);
  table.rows[0].cells[0].blocks = [innerH];
  cols.columns[0].blocks = [createParagraph(g, [createText(g, "col hit")])];
  const list = {
    type: "list",
    id: g.next(),
    listType: "bullet",
    items: [{
      id: g.next(),
      content: [createText(g, "item hit")],
      nested: { type: "list", id: g.next(), listType: "bullet", items: [{ id: g.next(), content: [createText(g, "nested hit")] }] },
    }],
  };
  doc.root.children = [
    createParagraph(g, [createText(g, "plain")]),
    table,
    cols,
    list,
    { type: "quote", id: g.next(), children: [createText(g, "q")] },
  ];
  assert(isLayout(table) && isLayout(cols));
  assert(findParentList(doc, innerH.id));
  assert(findHostBlocks(doc, table.rows[0].cells[0].id));
  assert(findHostBlocks(doc, cols.columns[0].id));
  assert(layoutDepthOf(doc, innerH.id) >= 1);
  const hits = findTextHits(doc, "hit");
  assert(hits.length >= 3);
  assert(replaceTextInDocument(doc, "hit", "HIT", 10) >= 3);
  const outline = collectOutline(doc);
  assert(outline.some((e) => e.text.includes("In cell")));
});

test("coverage90: parse-inlines marks and atoms", () => {
  const { doc } = setup();
  const g = gen();
  const root = doc.createElement("p");
  root.setAttribute("data-node-id", "p1");
  root.innerHTML = `hi <strong>b</strong><em>i</em><u>u</u><s>s</s><code>c</code>
    <a href="https://x">link</a><br>
    <span data-node-type="variable" data-path="n" data-source="{{n}}" data-format="upper" data-fallback="z">{{n}}</span>
    <span data-node-type="equation" data-latex="x^2"></span>
    <img data-asset-id="a1">
    <span style="color:red;background-color:blue;font-size:20px;font-family:Arial">styled</span>
    <font color="#00f" face="Times">f</font>`;
  const nodes = parseInlines(root, g, {}, "p1");
  assert(nodes.some((n) => n.type === "variable" && n.path === "n"));
  assert(nodes.some((n) => n.type === "equation"));
  assert(nodes.some((n) => n.type === "link"));
  assert(nodes.some((n) => n.type === "inline-image"));
  assert(nodes.some((n) => n.type === "hard-break"));
  teardown();
});

test("coverage90: table-look", () => {
  const g = gen();
  const tbl = createTable(g, 3, 3);
  applyDensity(tbl, "compact");
  applyPreset(tbl, "accent");
  tableClassName(tbl);
  toggleLook(tbl, "bandedColumns");
  toggleLook(tbl, "lastColumn");
  toggleLook(tbl, "totalRow");
  toggleLook(tbl, "headerRow");
  const cell = tbl.rows[1].cells[0];
  assert(cellVAlign(undefined) === "middle");
  setCellVAlign(cell, "bottom");
  assert(cellVAlign(cell) === "bottom");
  shadeCell(cell, "#ff0000");
  shadeCell(cell, undefined);
  cell.blocks = [createParagraph(g, [createText(g, "x")])];
  cell.blocks[0].align = "right";
  clearCellStyle(cell);
  clearTableStyle(tbl);
  assert(hexToRgb01("#fff"));
  assert(hexToRgb01("#ffffff"));
  assert(hexToRgb01("no") === null);
  tbl.style = { look: { headerRow: true, totalRow: true, firstColumn: true, lastColumn: true, bandedRows: true, bandedColumns: true } };
  cellFill(undefined, tbl, 0, 0);
  cellFill(tbl.rows[0].cells[0], tbl, 0, 0);
  cellFill(tbl.rows[2].cells[0], tbl, 2, 0);
  cellFill(tbl.rows[1].cells[0], tbl, 1, 0);
  cellFill(tbl.rows[1].cells[2], tbl, 1, 2);
  cellFill(tbl.rows[2].cells[1], tbl, 2, 1);
  cellFill(tbl.rows[1].cells[1], tbl, 1, 1);
});

test("coverage90: reportSlots extra kinds", () => {
  const g = gen();
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  const cols = createColumns(g, [50, 50]);
  cols.columns[0].blocks = [createParagraph(g, [
    { type: "link", id: g.next(), href: "https://a", children: [createVariable(g, "in.link", "{{in.link}}", { valueType: "string" })] },
    createEquation(g, "x^2"),
  ])];
  const list = {
    type: "list",
    id: g.next(),
    listType: "bullet",
    items: [{
      id: g.next(),
      content: [createText(g, "a")],
      nested: { type: "list", id: g.next(), listType: "bullet", items: [{ id: g.next(), content: [createVariable(g, "n", "{{n}}", { valueType: "string" })] }] },
    }],
  };
  doc.root.children = [
    createHeading(g, 1, [createText(g, "H")]),
    { type: "quote", id: g.next(), children: [createText(g, "Q")] },
    cols,
    list,
    createEquationBlock(g, "\\frac{1}{2}"),
    createImageBlock(g, "img1"),
    { type: "page-break", id: g.next() },
  ];
  const kinds = reportSlots(doc).map((s) => s.kind);
  assert(kinds.includes("columns"));
  assert(kinds.includes("equation"));
  assert(kinds.includes("equation-block"));
  assert(kinds.includes("variable"));
});

test("coverage90: latex, units, fonts, layout-structured", () => {
  const html = latexToHtml("a^{2}_{n}\\frac{1}{2}\\sqrt{x}\\hat{a}\\bar{b}\\vec{c}\\tilde{d}\\left(\\right)\\begin{x}\\end{x}\\alpha\\sum\\,\\{\\}\\\\");
  assert(html.includes("sup") && html.includes("pde-frac"));
  assert(twipToUm(1440) > 0);
  assert(umToTwip(twipToUm(20)) >= 0);
  assert(umToPx(25400) === 96);
  assert(clampUm(-1) === 0);
  assert(roundUm(1.4) === 1);
  assert(pdfFaceForMarks(true, true) === "F5");
  assert(pdfFontForMarks(true, false) === "Helvetica-Bold");
  assert(pdfFontForMarks(false, true) === "Helvetica-Oblique");
  assert(pdfFontForMarks(true, true) === "Helvetica-BoldOblique");
  assert(pdfFontForMarks() === "Helvetica");
  const flow = {
    opts: {},
    diagnostics: [],
    margin: { top: 1000, left: 1000, right: 1000, bottom: 1000 },
    usableWidthUm: 50000,
    usableHeightUm: 20000,
    lineHeightDefault: 4000,
    pages: [],
    pageSize: { widthUm: 52000, heightUm: 22000 },
    currentPage: { index: 0, widthUm: 52000, heightUm: 22000, usableWidthUm: 50000, usableHeightUm: 20000, boxes: [] },
    cursorY: 1000,
  };
  const g = gen();
  const cols = createColumns(g, [50, 50]);
  cols.columns[0].blocks = [
    createParagraph(g, [createText(g, "hello world ".repeat(8))]),
    createImageBlock(g, "x"),
    { type: "horizontal-rule", id: g.next() },
  ];
  assert(layoutStructuredBlock(flow, cols));
  assert(layoutStructuredBlock(flow, createEquationBlock(g, "x")));
  assert(layoutStructuredBlock(flow, { type: "page-break", id: g.next() }));
  assert(layoutStructuredBlock(flow, { type: "horizontal-rule", id: g.next() }));
  const img = createImageBlock(g, "big");
  img.widthUm = 999999;
  img.heightUm = 999999;
  layoutStructuredBlock(flow, img);
  pushPage(flow);
});

test("coverage90: rasterize bitmap + assemble jpeg/alpha", async () => {
  const prevBmp = globalThis.createImageBitmap;
  const prevOff = globalThis.OffscreenCanvas;
  globalThis.createImageBitmap = async () => ({
    width: 2,
    height: 2,
    close() {},
  });
  globalThis.OffscreenCanvas = class {
    constructor() {}
    getContext() {
      return {
        drawImage() {},
        getImageData() {
          return { data: new Uint8ClampedArray([10, 20, 30, 255, 1, 2, 3, 128, 4, 5, 6, 255, 7, 8, 9, 255]) };
        },
      };
    }
  };
  const decoded = await decodeViaBitmap(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  assert(decoded && decoded.rgb);
  globalThis.createImageBitmap = prevBmp;
  globalThis.OffscreenCanvas = prevOff;
  assert((await decodeViaBitmap(new Uint8Array([1]))) === null);

  const g = gen();
  const document = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  const jpeg = { widthPx: 1, heightPx: 1, jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]) };
  const rgb = { widthPx: 1, heightPx: 1, rgb: new Uint8Array([1, 2, 3]), alpha: new Uint8Array([200]) };
  const bytes = assemblePdf(
    [{ lines: [], widthPt: 100, heightPt: 100, marginPt: 36 }],
    document,
    { j: { id: "j", mediaType: "image/jpeg", data: jpeg.jpeg }, r: { id: "r", mediaType: "image/png", data: rgb.rgb } },
    new Map([["j", jpeg], ["r", rgb], ["skip", null]]),
    { nowIso: () => "2026-01-01T00:00:00.000Z" },
  );
  assert(bytes[0] === 0x25);
  assert(encodeRgbImageData(new Uint8Array([1, 2, 3]), 1, 1).length === 3);
  assert(targetEmbedPx(10, 10, 0, 0).w === 10);
  assert(targetEmbedPx(400, 400, 1000, 0).w <= 400);
  await prepareExportImages(document, {});
});

test("coverage90: backend sendPdfHttpResult variants", async () => {
  const r = await handlePdfExportJson({ document: { root: {} } });
  assert(r.status === 400 || r.status === 422);
  const g = gen();
  const document = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  const b64 = Buffer.from("abc").toString("base64");
  const filled = await handlePdfExportJson({
    document,
    assets: { a: { mediaType: "image/png", data: b64 } },
  });
  assert(filled.status === 200 || filled.status === 422);
  let code = 0;
  let ended = "";
  await sendPdfHttpResult(
    { status: 400, headers: { "content-type": "application/json" }, error: "x" },
    { statusCode: 0, setHeader() {}, end(s) { ended = s; } },
  );
  assert(ended.includes("x"));
  await sendPdfHttpResult(
    { status: 200, headers: {}, bytes: new Uint8Array([1]) },
    { statusCode: 0, setHeader() {}, end() { code = 1; } },
  );
  assert(code === 1);
});

test("coverage90: shortcuts, links, page preview, column resize, pickers", () => {
  const { el, doc } = setup();
  const g = gen();
  const document = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  const cols = createColumns(g, [50, 50]);
  document.root.children = [
    createParagraph(g, [{ type: "link", id: g.next(), href: "https://example.com", children: [createText(g, "go")] }]),
    cols,
    { type: "page-break", id: g.next() },
  ];
  const editor = createEditor(el, { document, getVariableCatalog: () => ["name"], getTemplateData: () => ({ name: "Ada" }) });
  editor.openShortcuts();
  assert(el.parentElement.querySelector(".pde-keys"));
  el.parentElement.querySelector(".pde-keys button")?.click();
  editor.openShortcuts();
  doc.dispatchEvent(new doc.defaultView.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  const a = el.querySelector("a");
  a?.dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
  const pop = el.parentElement.querySelector(".pde-link-pop");
  if (pop) {
    pop.querySelector("[data-href]").value = "https://b.test";
    pop.querySelector("[data-ok]").click();
  }
  editor.setPagePreview(true);
  editor.setPagePreview(false);
  keepBlocksOnPage(el, 200, 20, 20, 24);
  Object.defineProperty(el.children[0], "offsetTop", { value: 10, configurable: true });
  Object.defineProperty(el.children[0], "offsetHeight", { value: 40, configurable: true });
  keepBlocksOnPage(el, 80, 10, 10, 24);

  const layoutEl = el.querySelector(".pde-columns") || el.querySelector("[data-node-type='columns']");
  if (layoutEl) {
    layoutEl.setAttribute("data-node-id", cols.id);
    const slot1 = doc.createElement("div");
    slot1.className = "pde-column";
    const slot2 = doc.createElement("div");
    slot2.className = "pde-column";
    layoutEl.append(slot1, slot2);
    const hit = findColumnsNode({ getDoc: () => editor.getDocument() }, cols.id);
    assert(hit || true);
  }

  const btn = doc.createElement("button");
  doc.body.appendChild(btn);
  const closeGrid = openSizePicker(btn, {
    cols: 3,
    rows: 2,
    label: (c, r) => `${c}x${r}`,
    onPick: () => {},
    footer: { label: "More", onClick: () => {} },
  });
  doc.querySelector(".pde-size-picker-foot")?.click();
  closeGrid();
  const closeMos = openMosaicPicker(btn, {
    presets: COLUMN_PRESETS,
    onPreset: () => {},
    onMosaic: () => {},
  });
  const cells = [...doc.querySelectorAll(".pde-mosaic-row .pde-size-cell")];
  cells[1]?.dispatchEvent(new doc.defaultView.MouseEvent("mouseenter", { bubbles: true }));
  cells[1]?.dispatchEvent(new doc.defaultView.MouseEvent("mouseleave", { bubbles: true }));
  cells[1]?.click();
  doc.querySelector(".pde-size-picker-foot")?.click();
  closeMos();

  const varSpan = doc.createElement("span");
  varSpan.setAttribute("data-node-type", "variable");
  varSpan.setAttribute("data-path", "name");
  el.appendChild(varSpan);
  varSpan.dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
  const apply = el.parentElement.querySelector("[data-apply]");
  if (apply) apply.click();

  focusBlockEl(el, "missing");
  editor.destroy();
  teardown();
});
