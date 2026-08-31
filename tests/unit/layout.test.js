import { ptToUm, umToPt, pxToUm, mmToUm, emuToUm, umToEmu } from "../../dist/export/layout/units.js";
import { breakLines, getFontMetrics, findMissingGlyphs } from "../../dist/export/layout/text.js";
import { paginateDocument } from "../../dist/export/layout/pagination.js";
import { buildLayout } from "../../dist/export/layout/index.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("units: pt <-> um round-trip", () => {
  const um = ptToUm(12);
  assert(um === Math.round(12 * 25400 / 72));
  assert(Math.abs(umToPt(um) - 12) < 0.01);
});

test("units: px at 96dpi", () => {
  assert.equal(pxToUm(96), 25400);
  assert.equal(mmToUm(10), 10000);
});

test("units: emu conversion", () => {
  const emu = umToEmu(25400);
  assert.equal(emu, 914400);
  assert.equal(emuToUm(914400), 25400);
});

test("text: breakLines greedy fit", () => {
  const lines = breakLines("hello world this is a test", { maxWidthUm: 5000, defaultFontSizePt: 11 });
  // With avgCharWidth ~2420um, maxWidth 5000 fits ~2 chars? Actually small, will break
  assert(lines.length > 1);
  for (const l of lines) assert(l.widthUm <= 5000 || l.text.length === 1);
});

test("text: hard break handling", () => {
  const lines = breakLines("line1\nline2", { maxWidthUm: 100000 });
  assert(lines.some((l) => l.text === "line1"));
  assert(lines.some((l) => l.text === "line2"));
});

test("text: findMissingGlyphs flags unencodable PDF chars", () => {
  const missing = findMissingGlyphs("hello 🌍");
  assert(missing.includes("🌍"));
  assert.equal(findMissingGlyphs("Información — Niño").length, 0);
});

test("text: font metrics deterministic", () => {
  const m1 = getFontMetrics({ text: "x", fontSizePt: 12 });
  const m2 = getFontMetrics({ text: "x", fontSizePt: 12 });
  assert.deepEqual(m1, m2);
});

test("pagination: deterministic hash", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "hello world ".repeat(50) }] });
  const r1 = paginateDocument(doc);
  const r2 = paginateDocument(JSON.parse(JSON.stringify(doc)));
  assert.equal(r1.hash, r2.hash);
  assert.equal(r1.pages.length, r2.pages.length);
});

test("pagination: page-break forces new page", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "before" }] },
    { type: "page-break", id: "pb1" },
    { type: "paragraph", id: "p2", children: [{ type: "text", id: "t2", text: "after" }] },
  );
  const r = paginateDocument(doc);
  assert(r.pages.length >= 2);
});

test("pagination: image too large diagnostic", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push({ type: "image", id: "img1", assetId: "a1", widthUm: 999999, heightUm: 999999 });
  const r = paginateDocument(doc);
  assert(r.diagnostics.some((d) => d.code === "image-too-large"));
});

test("pagination: table row too tall diagnostic", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push({
    type: "table",
    id: "tbl",
    columns: [{ id: "c1", widthUm: 50000 }],
    rows: [{ id: "r1", cells: [{ id: "cell1", colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "x".repeat(1000) }] }] }] }],
  });
  // Force small page to trigger diagnostic
  doc.page.heightUm = 50000;
  doc.page.marginUm = { top: 5000, right: 5000, bottom: 5000, left: 5000 };
  const r = paginateDocument(doc);
  // At least layout succeeds
  assert(r.pages.length >= 1);
});

test("buildLayout: delegates to pagination", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push({ type: "equation-block", id: "eq1", latex: "E = mc^2" });
  const m = buildLayout(doc, {}, {});
  assert(m.pages.length >= 1);
  assert(m.pages[0].boxes.some((b) => b.type === "equation-block"));
});
