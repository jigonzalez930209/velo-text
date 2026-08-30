import { JSDOM } from "jsdom";
import { createDocument, createIdGenerator, createHeading, createParagraph, createText } from "../../dist/core/model/factories.js";
import { exportPdf, collectPdfDiagnostics } from "../../dist/export/pdf/export-pdf.js";
import { DOCUMENT_FONTS, resolveDocumentFont } from "../../dist/fonts/catalog.js";
import { documentFontBytes, documentFontsCss, ensureDocumentFonts, parseTtfMetrics, pdfWidths1000, ttfTextWidth } from "../../dist/fonts/index.js";
import { pdfFaceForMarks, pdfFontForMarks } from "../../dist/export/pdf/fonts.js";
import { createEditor } from "../../dist/editor-web/controller/index.js";

test("four document fonts resolve and produce distinct OFL TTF", () => {
  assert.equal(DOCUMENT_FONTS.length, 4);
  assert(resolveDocumentFont("serif")?.id === "serif");
  assert(resolveDocumentFont("Velo Mono")?.pdfFaceRegular === "Fe");
  assert(resolveDocumentFont("") === undefined);
  assert(!resolveDocumentFont("Georgia"));
  const sizes = DOCUMENT_FONTS.map((f) => documentFontBytes(f.id).length);
  assert(sizes.every((n) => n > 10_000));
  assert(documentFontBytes("sans")[0] === 0 && documentFontBytes("sans")[1] === 1);
  const sansW = ttfTextWidth(documentFontBytes("sans"), "Hello", 12);
  const monoW = ttfTextWidth(documentFontBytes("mono"), "Hello", 12);
  assert(sansW > 0 && monoW > 0);
  assert(sansW !== monoW);
  const { widths } = parseTtfMetrics(documentFontBytes("sans"));
  assert(new Set(widths).size > 10, "cmap/hmtx widths must not collapse to one advance");
  assert(widths[65 - 32] !== widths[108 - 32], "A and l should differ");
  assert.equal(widths[0], 569, "space advance in Liberation Sans");
  assert.equal(widths[65 - 32], 1366, "A advance in Liberation Sans");
  assert.equal(widths[108 - 32], 455, "l advance in Liberation Sans");
  const pdfW = pdfWidths1000(documentFontBytes("sans"));
  assert.equal(pdfW[0], 278, "PDF /Widths use 1/1000 text space");
  assert.equal(pdfW[65 - 32], 667, "PDF /Widths for A");
  const families = new Set(DOCUMENT_FONTS.map((f) => documentFontBytes(f.id).byteLength));
  assert.equal(families.size, 4);
});

test("documentFontsCss lists all four families with normal and italic weights", () => {
  const css = documentFontsCss();
  for (const f of DOCUMENT_FONTS) {
    assert(css.includes(`font-family:"${f.cssName}"`));
    assert(css.includes("font-weight:400"));
    assert(css.includes("font-weight:700"));
    assert(css.includes("font-style:italic"));
  }
  assert(css.includes("data:font/ttf;base64,"));
  assert.equal((css.match(/@font-face/g) ?? []).length, 16);
});

test("ensureDocumentFonts injects once", () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
  ensureDocumentFonts(dom.window.document);
  ensureDocumentFonts(dom.window.document);
  assert.equal(dom.window.document.querySelectorAll("#velo-document-fonts").length, 1);
});

test("pdfFaceForMarks maps document families and defaults to Velo Sans", () => {
  assert.equal(pdfFaceForMarks(false, false, "Velo Display"), "Fg");
  assert.equal(pdfFaceForMarks(true, false, "monospace"), "Ff");
  assert.equal(pdfFaceForMarks(false, true, "Velo Serif"), "Fk");
  assert.equal(pdfFaceForMarks(true, true, "Velo Serif"), "Fl");
  assert.equal(pdfFaceForMarks(false, true), "Fi");
  assert.equal(pdfFaceForMarks(false, false), "Fa");
  assert.equal(pdfFaceForMarks(true, false), "Fb");
  assert.equal(pdfFontForMarks(false, false, "Velo Sans"), "LiberationSans");
  assert.equal(pdfFontForMarks(true, false), "LiberationSans-Bold");
  assert.equal(pdfFontForMarks(false, true, "Velo Sans"), "LiberationSans-Italic");
  assert.equal(pdfFontForMarks(true, true, "Velo Serif"), "LiberationSerif-BoldItalic");
  assert.equal(pdfFontForMarks(true, true, "Georgia"), "Helvetica-BoldOblique");
});

test("exportPdf embeds italic Liberation faces", async () => {
  const g = createIdGenerator("ffi");
  const clock = { nowIso: () => "2026-08-28T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: g, clock });
  doc.root.children.push(createParagraph(g, [
    createText(g, "i", { italic: true, fontFamily: "Velo Serif", bold: true }),
  ]));
  const a = await exportPdf({ document: doc, data: {}, options: { strict: false }, clock });
  const text = Buffer.from(a.bytes).toString("latin1");
  assert(text.includes("/BaseFont /LiberationSerif-BoldItalic"));
  assert(text.includes("/Fl "), "bold italic serif uses Fl face");
});

test("exportPdf embeds Liberation TTF for all four faces", async () => {
  const g = createIdGenerator("ff");
  const clock = { nowIso: () => "2026-08-28T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: g, clock });
  doc.root.children.push(createParagraph(g, DOCUMENT_FONTS.map((f) =>
    createText(g, f.id, { fontFamily: f.cssName }),
  )));
  const a = await exportPdf({ document: doc, data: {}, options: { strict: false }, clock });
  const text = Buffer.from(a.bytes).toString("latin1");
  assert(text.includes("/BaseFont /LiberationSans"));
  assert(text.includes("/BaseFont /LiberationSerif"));
  assert(text.includes("/BaseFont /LiberationMono"));
  assert(text.includes("/BaseFont /LiberationSansNarrow"));
  assert(text.includes("/FontFile2"));
  assert(text.includes("/Widths [278"), "PDF Widths must be scaled to 1/1000 em");
  assert(/\/Fa \d+ Tf/.test(text));
  const d = collectPdfDiagnostics(doc, {});
  assert(!d.some((x) => x.code === "pdf-font-family-ignored"), JSON.stringify(d));
});

test("exportPdf headings use default sans bold face", async () => {
  const g = createIdGenerator("ffh");
  const clock = { nowIso: () => "2026-08-28T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: g, clock });
  doc.root.children.push(createHeading(g, 1, [createText(g, "Headings")]));
  const a = await exportPdf({ document: doc, data: {}, options: { strict: false }, clock });
  const text = Buffer.from(a.bytes).toString("latin1");
  assert(text.includes("/Fb "), "heading should paint with sans bold");
});

test("unknown fontFamily still warns", () => {
  const g = createIdGenerator("ff2");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-28T12:00:00.000Z" } });
  doc.root.children.push(createParagraph(g, [createText(g, "x", { fontFamily: "Georgia" })]));
  const d = collectPdfDiagnostics(doc, {});
  assert(d.some((x) => x.code === "pdf-font-family-ignored"));
});

test("setFontFamily applies with stashed selection after focus leaves editor", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="ed"></div></body>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Node = dom.window.Node;
  globalThis.Selection = dom.window.Selection;
  globalThis.Range = dom.window.Range;
  const el = dom.window.document.getElementById("ed");
  const g = createIdGenerator("sf");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push({
    type: "paragraph",
    id: "p1",
    children: [{ type: "text", id: "t1", text: "word" }],
  });
  const editor = createEditor(el, { document: doc });
  const saved = editor.captureTextSelection();
  assert(!saved, "no selection yet");
  const p = el.querySelector('[data-node-id="p1"]');
  const textNode = p.firstChild;
  const range = dom.window.document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, 4);
  const sel = dom.window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  const stashed = editor.captureTextSelection();
  assert(stashed?.blockId === "p1");
  sel.removeAllRanges();
  editor.commands.setFontFamily("Velo Mono", stashed);
  const ast = editor.getDocument().root.children[0].children[0];
  assert.equal(ast.marks?.fontFamily, "Velo Mono");
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.Node;
  delete globalThis.Selection;
  delete globalThis.Range;
});

test("setFontFamily replaces prior face without nesting spans", () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="ed"></div></body>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Node = dom.window.Node;
  globalThis.NodeFilter = dom.window.NodeFilter;
  globalThis.Selection = dom.window.Selection;
  globalThis.Range = dom.window.Range;
  const el = dom.window.document.getElementById("ed");
  const g = createIdGenerator("sf");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push({
    type: "paragraph",
    id: "p1",
    children: [{ type: "text", id: "t1", text: "word" }],
  });
  const editor = createEditor(el, { document: doc });
  const p = el.querySelector('[data-node-id="p1"]');
  const textNode = p.firstChild;
  const range = dom.window.document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, 4);
  const sel = dom.window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  for (const fam of ["Velo Sans", "Velo Serif", "Velo Mono", "Velo Display"]) {
    editor.commands.setFontFamily(fam);
  }
  const spans = p.querySelectorAll("span[style*='font-family']");
  assert.equal(spans.length, 1, "single font-family span");
  assert(spans[0].style.fontFamily.includes("Velo Display"));
  const ast = editor.getDocument().root.children[0].children[0];
  assert.equal(ast.marks?.fontFamily, "Velo Display");
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.Node;
  delete globalThis.NodeFilter;
  delete globalThis.Selection;
  delete globalThis.Range;
});
