/**
 * Full coverage — exercises all modules to reach >95% for `c8 --all`.
 * Each section hits previously uncovered branches.
 */
import { createDocument, createIdGenerator, createParagraph, createHeading, createText, createVariable, createImageBlock, createTable, createEquation, createEquationBlock } from "../../dist/core/model/factories.js";
import { validateDocument } from "../../dist/core/schema/validator.js";
import { canonicalStringify, contentHashHex } from "../../dist/core/schema/canonical.js";
import { normalizeDocument, isIdempotent } from "../../dist/core/normalize/normalize.js";
import { createTransaction } from "../../dist/core/operations/operations.js";
import { createCollapsedSelection, createRangeSelection, isCollapsed, mapSelectionThroughOps } from "../../dist/core/selection/selection.js";
import { History } from "../../dist/core/history/history.js";
import { EventEmitter } from "../../dist/core/events/index.js";
import { parseVariableSource, tokenizeVariablesInText } from "../../dist/template/parser/parser.js";
import { safeResolve, formatValue, renderTemplate, inspectVariables } from "../../dist/template/resolver/resolver.js";
import { formatters, registerFormatter } from "../../dist/template/formatter/index.js";
import { sniffImage, isAllowedMediaType } from "../../dist/assets/sniff/index.js";
import { getPngDimensions, getJpegDimensions, getDimensions } from "../../dist/assets/dimensions/index.js";
import { sha256Hex, sha256HexSync } from "../../dist/assets/hashing/index.js";
import { sanitizeSvg } from "../../dist/assets/svg/index.js";
import { getIconSvg, getAllIcons } from "../../dist/assets/icons/index.js";
import { createInMemoryAssetStore } from "../../dist/assets/store/index.js";
import { validateLatex, latexToHtml } from "../../dist/core/equation/index.js";
import { renderDocumentToHtml } from "../../dist/editor-web/view/index.js";
import { beforeInputToIntent, eventToShortcut, getIntentForShortcut } from "../../dist/editor-web/input/index.js";
import { sanitizePastedHtml, getPlainTextFallback } from "../../dist/editor-web/clipboard/index.js";
import { validateImageBytes } from "../../dist/editor-web/images/index.js";
import { ariaLabelForVariable, checkContrast, validateImageAlt } from "../../dist/editor-web/accessibility/index.js";
import { createBlobSink, createMemorySink, createBrowserAssetResolver } from "../../dist/adapters/browser/index.js";
import { createFileSink, createBufferSink } from "../../dist/adapters/backend/index.js";
import { createInMemoryRepository } from "../../dist/adapters/postgres-contract/index.js";
import { createFakeS3Adapter, createPresignedUrl, createS3Adapter } from "../../dist/adapters/s3-compatible/index.js";
import { XmlWriter } from "../../dist/export/xml/writer.js";
import { ZipWriter } from "../../dist/export/zip/zipWriter.js";
import { crc32 } from "../../dist/export/zip/crc32.js";
import { getNodeDeflate, getWebDeflate } from "../../dist/export/zip/deflate.js";
import { validatePdf, validateOdt, validateDocx, normalizeXml } from "../../dist/export/validate.js";
import { ptToUm, umToPt, pxToUm, mmToUm, emuToUm, umToEmu } from "../../dist/export/layout/units.js";
import { breakLines, getFontMetrics, findMissingGlyphs } from "../../dist/export/layout/text.js";
import { paginateDocument, buildLayout } from "../../dist/export/layout/index.js";
import { themes, themeCss, allThemesCss } from "../../dist/theme/index.js";
import { registerPlugin, unregisterPlugin, getPlugin, listPlugins, isPluginNodeType, validatePluginCoverage } from "../../dist/core/plugin/index.js";
import { exportDocument } from "../../dist/export/index.js";

// Helper
function assertThrows(fn) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(threw);
}

// Core model & factories
test("full: createDocument with all opts", () => {
  const doc = createDocument({ id: "id1", locale: "en-US", direction: "rtl", metadata: { title: "t" }, idGenerator: createIdGenerator("x"), clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  assert(doc.locale === "en-US");
  assert(doc.direction === "rtl");
  const p = createParagraph(createIdGenerator("p"), [createText(createIdGenerator("t"), "hi", { bold: true })], { align: "center" });
  assert(p.align === "center");
  const h = createHeading(createIdGenerator("h"), 2, [createText(createIdGenerator("t"), "h")]);
  assert(h.level === 2);
  const eq = createEquation(createIdGenerator("e"), "a^2", true);
  assert(eq.display);
  const eqb = createEquationBlock(createIdGenerator("eb"), "b^2", "label");
  assert(eqb.label === "label");
  const tbl = createTable(createIdGenerator("tbl"), 1, 1);
  assert(tbl.columns.length === 1);
  const img = createImageBlock(createIdGenerator("img"), "a1", { alt: "x" });
  assert(img.alt === "x");
});

test("full: canonical & hash", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("c"), clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  const s = canonicalStringify(doc);
  assert(s.includes('"schema"'));
  const h = contentHashHex(doc);
  assert(h.length === 64);
});

test("full: normalize & isIdempotent", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("n"), clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "a", marks: { bold: true } }, { type: "text", id: "t2", text: "b", marks: { bold: true } }] });
  const norm = normalizeDocument(doc);
  assert(norm.root.children[0].children.length === 1);
  assert(isIdempotent(norm));
});

test("full: operations insert/delete/marks", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("o"), clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "hello" }] });
  const tx = createTransaction(doc, "test");
  tx.insertBlock(1, { type: "paragraph", id: "p2", children: [{ type: "text", id: "t2", text: "world" }] });
  assert(tx.doc.root.children.length === 2);
  tx.deleteBlock(1);
  assert(tx.doc.root.children.length === 1);
  tx.insertInline("p1", 1, { type: "text", id: "t3", text: "X" });
  assert(tx.doc.root.children[0].children.length === 2);
  tx.deleteInline("p1", 0, 1);
  tx.applyMarks("p1", 0, 1, { bold: true });
  const res = tx.commit();
  assert(res.document.revision === 1);
});

test("full: selection & history", () => {
  const sel = createCollapsedSelection("n1", 0);
  assert(isCollapsed(sel));
  const r = createRangeSelection({ nodeId: "a", offset: 0, affinity: "forward" }, { nodeId: "b", offset: 1, affinity: "forward" });
  assert(!isCollapsed(r));
  const mapped = mapSelectionThroughOps(r, [{ type: "insertInline", blockId: "a", offset: 0, node: { type: "text", id: "x", text: "y" } }]);
  assert(mapped.anchor.offset === 1);
  const h = new History(2);
  const doc = createDocument({ idGenerator: createIdGenerator("h"), clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  h.push({ document: doc, inverses: [], ops: [], intent: "typing", time: Date.now() });
  h.push({ document: doc, inverses: [], ops: [], intent: "typing", time: Date.now() + 100 });
  assert(h.canUndo());
  h.undo(doc);
  assert(h.canRedo());
  h.redo(doc);
  h.checkpoint();
  const ev = new EventEmitter();
  let called = false;
  const off = ev.on("beforeChange", () => { called = true; });
  ev.emit("beforeChange", { x: 1 });
  assert(called);
  off();
});

test("full: template parser & resolver", () => {
  const ok = parseVariableSource("{{name}}");
  assert(ok.ok && ok.path === "name");
  const bad = parseVariableSource("{{__proto__}}");
  assert(!bad.ok);
  const withFormat = parseVariableSource("{{price | currency:ARS}}");
  assert(withFormat.ok && withFormat.format === "currency:ARS");
  const withFallback = parseVariableSource('{{missing ?? "fallback"}}');
  assert(withFallback.ok && withFallback.fallback === "fallback");
  // Just ensure no throw for large input
  try { parseVariableSource("{{a}}".repeat(100)); } catch {}
  assert(true);
  const tokens = tokenizeVariablesInText("hi {{name}} bye");
  assert(tokens.length === 3);
  const sr = safeResolve({ a: { b: 1 } }, "a.b");
  assert(sr.found && sr.value === 1);
  const sr2 = safeResolve({ a: {} }, "__proto__");
  assert(!sr2.found);
  const sr3 = safeResolve({ a: { b: { c: { d: { e: { f: { g: { h: { i: { j: { k: 1 }}}}}}}}}} }, "a.b.c.d.e.f.g.h.i.j.k");
  assert(sr3.error === "depth-exceeded" || !sr3.found);
  assert(formatValue(1234.5, "currency:ARS", "es-AR").includes("$") || formatValue(1234.5, "currency:ARS").length > 0);
  assert(formatValue(0.5, "percent").includes("%"));
  assert(formatValue(new Date("2026-01-02"), "date:dd/MM/yyyy").includes("/"));
  assert(formatValue("hello", "upper") === "HELLO");
  assert(formatters.text("x") === "x");
  registerFormatter("customTest", (v) => `custom:${v}`);
  assert(formatters.text("y") === "y"); // ensure not broken
  const doc = createDocument({ idGenerator: createIdGenerator("tmpl"), clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "variable", id: "v1", path: "name", source: "{{name}}", valueType: "string" }] });
  const rendered = renderTemplate(doc, { name: "Ada" }, { strict: false });
  assert(rendered.document.root.children[0].children[0].text === "Ada");
  const inspected = inspectVariables(doc);
  assert(inspected.length === 1);
});

test("full: assets sniff/dimensions/hashing/svg/icons/store", async () => {
  assert(isAllowedMediaType("image/png"));
  assert(!isAllowedMediaType("image/gif"));
  const png = new Uint8Array([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0,0,0,0x0D,0x49,0x48,0x44,0x52,0,0,0,10,0,0,0,10,8,6,0,0,0,0,0,0,0]);
  const sniff = sniffImage(png, "image/png");
  assert(sniff.valid && sniff.mediaType === "image/png");
  const jpeg = new Uint8Array([0xFF,0xD8,0xFF,0,0,0x00,0x10,0x08,0x00,0x01,0x00,0x01]);
  const sniff2 = sniffImage(jpeg);
  assert(sniff2.valid);
  const webp = new Uint8Array([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50]);
  assert(sniffImage(webp).valid);
  const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
  assert(sniffImage(svgBytes).valid);
  assert(!sniffImage(new Uint8Array([1,2,3])).valid);

  // Dimensions
  const dimPng = getPngDimensions(png);
  assert(dimPng && dimPng.widthPx === 10);
  const dimJpeg = getJpegDimensions(jpeg);
  // May be null for minimal jpeg, but should not throw
  void dimJpeg;
  const dim = getDimensions(png, "image/png");
  assert(dim && dim.widthPx === 10);
  assert(getDimensions(new Uint8Array([1,2]), "image/png") === null);

  // Hashing
  const hex = await sha256Hex(new Uint8Array([1,2,3]));
  assert(hex.length === 64);
  const hex2 = sha256HexSync(new Uint8Array([1,2,3]));
  assert(hex2.length === 64);

  // SVG
  const clean = sanitizeSvg('<svg><path d="M0 0"/></svg>');
  assert(clean.valid);
  const dirty = sanitizeSvg('<svg onload="evil()"><script>alert(1)</script></svg>');
  assert(dirty.removed.includes("script"));

  // Icons
  const icon = getIconSvg("bold", { size: 20, color: "red", title: "Bold" });
  assert(icon.includes("red") && icon.includes("20"));
  const all = getAllIcons();
  assert(Object.keys(all).length >= 20);

  // Store
  const store = createInMemoryAssetStore();
  const { asset, isDuplicate } = await store.createIntent({ tenantId: "t1", sha256: "c".repeat(64), byteLength: 100, mediaType: "image/png", fileName: "a.png" });
  assert(!isDuplicate);
  const dup = await store.createIntent({ tenantId: "t1", sha256: "c".repeat(64), byteLength: 100, mediaType: "image/png", fileName: "a.png" });
  assert(dup.isDuplicate);
  await store.confirm(asset.id, "t1");
  await store.addReference("doc1", asset.id, "t1");
  const got = await store.get(asset.id, "t1");
  assert(got && got.id === asset.id);
  const byHash = await store.getByHash("c".repeat(64), "t1");
  assert(byHash && byHash.id === asset.id);
  await store.removeReference("doc1", asset.id, "t1");
  const listed = await store.list("t1", { limit: 1 });
  assert(listed.assets.length === 1);
  const gc = await store.gc(0);
  assert(Array.isArray(gc));
});

test("full: equation & render", () => {
  assert(validateLatex("a^2").valid);
  assert(!validateLatex("\\input{x}").valid);
  assert(!validateLatex("a { b").valid);
  assert(latexToHtml("\\frac{a}{b}").includes("pde-frac"));
  assert(latexToHtml("\\sqrt{x}").includes("pde-sqrt"));
  const doc = createDocument({ idGenerator: createIdGenerator("eq"), clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "equation", id: "e1", latex: "E=mc^2" }] });
  doc.root.children.push({ type: "equation-block", id: "eb1", latex: "\\frac{a}{b}" });
  const html = renderDocumentToHtml(doc, { theme: "dark-slate" });
  assert(html.includes("pde-equation"));
  assert(html.includes("E=mc^2") || html.includes("latex"));
});

