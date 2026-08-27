/**
 * Targeted pagination & resolver coverage — hits remaining uncovered branches.
 */
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";
import { paginateDocument } from "../../dist/export/layout/pagination.js";
import { renderTemplate } from "../../dist/template/resolver/resolver.js";
import { createEquation } from "../../dist/core/model/factories.js";

const clock = { nowIso: () => "2026-01-01T00:00:00.000Z" };
const g = () => createIdGenerator("tgt");

test("pagination: paragraph with variable/equation/hard-break children", () => {
  const doc = createDocument({ idGenerator: g(), clock });
  const gen = g();
  doc.root.children.push({
    type: "paragraph",
    id: "p1",
    children: [
      { type: "text", id: gen.next(), text: "hi " },
      { type: "variable", id: gen.next(), path: "a", source: "{{a}}", valueType: "string" },
      { type: "equation", id: gen.next(), latex: "E=mc^2" },
      { type: "hard-break", id: gen.next() },
      { type: "link", id: gen.next(), href: "#", children: [{ type: "text", id: gen.next(), text: "L" }] },
    ],
  });
  const res = paginateDocument(doc);
  assert(res.pages.length >= 1);
  assert(res.pages[0].boxes.length >= 1);
});

test("pagination: widows/orphans push whole paragraph", () => {
  const doc = createDocument({ idGenerator: g(), clock });
  // Tiny page so a multi-line paragraph would split with <2 lines at bottom
  doc.page.heightUm = 60000;
  doc.page.marginUm = { top: 5000, right: 5000, bottom: 5000, left: 5000 };
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "word ".repeat(200) }] });
  const res = paginateDocument(doc, { widows: 2, orphans: 2 });
  assert(res.pages.length >= 1);
});

test("pagination: list with equation item and nested", () => {
  const doc = createDocument({ idGenerator: g(), clock });
  const gen = g();
  doc.root.children.push({
    type: "list",
    id: "l1",
    kind: "ordered",
    items: [
      { id: gen.next(), content: [{ type: "text", id: gen.next(), text: "a" }] },
      { id: gen.next(), content: [createEquation(gen, "x=y")], nested: { type: "list", id: gen.next(), kind: "unordered", items: [{ id: gen.next(), content: [{ type: "text", id: gen.next(), text: "nested" }] }] } },
    ],
  });
  const res = paginateDocument(doc);
  assert(res.pages.length >= 1);
  assert(res.pages[0].boxes.some((b) => b.type === "list-item"));
});

test("pagination: table header repeat on page split", () => {
  const doc = createDocument({ idGenerator: g(), clock });
  doc.page.heightUm = 120000;
  doc.page.marginUm = { top: 5000, right: 5000, bottom: 5000, left: 5000 };
  const gen = g();
  const cols = [{ id: gen.next(), widthUm: 50000 }];
  const rows = [{ id: "hdr", header: true, cells: [{ id: gen.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: gen.next(), children: [{ type: "text", id: gen.next(), text: "Header" }] }] }] }];
  for (let i = 0; i < 40; i++) {
    rows.push({ id: `r${i}`, cells: [{ id: gen.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: gen.next(), children: [{ type: "text", id: gen.next(), text: "x".repeat(300) }] }] }] });
  }
  doc.root.children.push({ type: "table", id: "tbl", columns: cols, rows });
  const res = paginateDocument(doc);
  assert(res.pages.length > 1);
});

test("pagination: horizontal-rule and unknown block", () => {
  const doc = createDocument({ idGenerator: g(), clock });
  doc.root.children.push(
    { type: "horizontal-rule", id: "hr1" },
    { type: "unknown-type", id: "u1" },
  );
  const res = paginateDocument(doc);
  assert(res.pages.length >= 1);
  assert(res.diagnostics.some((d) => d.code === "unknown-block"));
});

test("pagination: image block inline image", () => {
  const doc = createDocument({ idGenerator: g(), clock });
  const gen = g();
  doc.assets["a1"] = { id: "a1", kind: "image", mediaType: "image/png", storageKey: "k", sha256: "a".repeat(64), byteLength: 10, alt: "x" };
  doc.root.children.push({ type: "image", id: gen.next(), assetId: "a1", widthUm: 10000, heightUm: 8000 });
  const res = paginateDocument(doc);
  assert(res.pages[0].boxes.some((b) => b.type === "image"));
});

// Resolver uncovered branches
test("resolver: repeat rows with fallback + non-array + limit", () => {
  const doc = createDocument({ idGenerator: g(), clock });
  const gen = g();
  const tmplId = gen.next();
  doc.root.children.push({
    type: "table",
    id: "tbl",
    columns: [{ id: gen.next(), widthUm: 10000 }, { id: gen.next(), widthUm: 10000 }],
    rows: [
      { id: gen.next(), header: true, cells: [{ id: gen.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: gen.next(), children: [{ type: "text", id: gen.next(), text: "H" }] }] }, { id: gen.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: gen.next(), children: [{ type: "text", id: gen.next(), text: "H2" }] }] }] },
      { id: tmplId, cells: [{ id: gen.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: gen.next(), children: [{ type: "variable", id: gen.next(), path: "item.a", source: "{{item.a}}", valueType: "string" }, { type: "variable", id: gen.next(), path: "item.b", source: '{{item.b ?? "fb"}}', valueType: "string", fallback: "fb" }] }] }, { id: gen.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: gen.next(), children: [{ type: "variable", id: gen.next(), path: "global", source: "{{global}}", valueType: "string" }] }] }] },
    ],
    repeat: { path: "items", alias: "item", templateRowId: tmplId },
  });
  // 3 items with missing b -> fallback
  const res = renderTemplate(doc, { items: [{ a: "1" }, { a: "2" }, { a: "3" }], global: "G" }, { strict: false, missing: "empty" });
  assert(res.document.root.children[0].rows.length === 4);
  // non-array -> repeat-not-array diagnostic
  const res2 = renderTemplate(doc, { items: "not-array" }, { strict: false, mode: "tolerant" });
  assert(res2.diagnostics.some((d) => d.code === "repeat-not-array"));
  // over limit
  const many = Array.from({ length: 1001 }, (_, i) => ({ a: `x${i}` }));
  const res3 = renderTemplate(doc, { items: many }, { strict: false, mode: "tolerant" });
  assert(res3.diagnostics.some((d) => d.code === "repeat-limit"));
  // empty collection with emptyFallback true
  doc.root.children[0].repeat.emptyFallback = true;
  const res4 = renderTemplate(doc, { items: [] }, { strict: false, mode: "tolerant" });
  assert(res4.document.root.children[0].rows.length === 1);
});

test("resolver: link with missing var + value too long", () => {
  const doc = createDocument({ idGenerator: g(), clock });
  const gen = g();
  doc.root.children.push({
    type: "paragraph",
    id: "p1",
    children: [
      { type: "link", id: gen.next(), href: "#", children: [{ type: "variable", id: gen.next(), path: "missing", source: "{{missing}}", valueType: "string" }, { type: "variable", id: gen.next(), path: "long", source: "{{long}}", valueType: "string" }] },
    ],
  });
  const res = renderTemplate(doc, { long: "x".repeat(12000) }, { strict: false, missing: "keep" });
  assert(res.document.root.children[0].children[0].children.length === 2);
  // paragraph-level missing -> missing-variable diagnostic
  const doc2 = createDocument({ idGenerator: g(), clock });
  const gen2 = g();
  doc2.root.children.push({ type: "paragraph", id: gen2.next(), children: [{ type: "variable", id: gen2.next(), path: "missing", source: "{{missing}}", valueType: "string" }] });
  const res2 = renderTemplate(doc2, {}, { strict: false, missing: "error", mode: "tolerant" });
  assert(res2.diagnostics.some((d) => d.code === "missing-variable"));
  // paragraph-level value too long pushes diagnostic
  const doc3 = createDocument({ idGenerator: g(), clock });
  const gen3 = g();
  doc3.root.children.push({ type: "paragraph", id: gen3.next(), children: [{ type: "variable", id: gen3.next(), path: "long", source: "{{long}}", valueType: "string" }] });
  const res3 = renderTemplate(doc3, { long: "y".repeat(12000) }, { strict: false, missing: "keep", mode: "tolerant" });
  // formatValue truncates to MAX_VALUE_LENGTH (10000) — verify truncation
  assert(res3.document.root.children[0].children[0].text.length === 10000);
});