import { paginateDocument } from "../../dist/export/layout/pagination.js";
import { resolveDynamicVariables, substituteVarString } from "../../dist/export/layout/dynamic-vars.js";
import { buildPdfPages } from "../../dist/export/pdf/layout-pages.js";
import { PdfWriter } from "../../dist/export/pdf/writer.js";
import { validateDocument } from "../../dist/core/schema/validator.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("header-footer: dynamic variable substitution helper", () => {
  const vars = {
    pageNumber: 3,
    totalPages: 10,
    documentTitle: "Quarterly Report",
    date: "2026-09-03",
  };
  const replaced = substituteVarString("Doc: {{documentTitle}} | Page {{pageNumber}} of {{totalPages}} ({{date}})", vars);
  assert.equal(replaced, "Doc: Quarterly Report | Page 3 of 10 (2026-09-03)");

  const nodes = [
    { type: "text", id: "t1", text: "Page {{pageNumber}} of {{totalPages}}" },
    { type: "variable", id: "v1", path: "documentTitle", source: "{{documentTitle}}", valueType: "string" },
  ];
  const resolved = resolveDynamicVariables(nodes, vars);
  assert.equal(resolved[0].type, "text");
  assert.equal(resolved[0].text, "Page 3 of 10");
  assert.equal(resolved[1].type, "text");
  assert.equal(resolved[1].text, "Quarterly Report");
});

test("header-footer: document without headerFooter preserves default layout", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "paragraph",
    id: "p1",
    children: [{ type: "text", id: "t1", text: "Single paragraph without headers or footers." }],
  });
  const res = paginateDocument(doc);
  assert.equal(res.pages.length, 1);
  assert.equal(res.pages[0].headerBoxes, undefined);
  assert.equal(res.pages[0].footerBoxes, undefined);
});

test("header-footer: two-pass pagination populates headerBoxes and footerBoxes with variables", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.metadata = { title: "Annual Review" };
  doc.page.headerFooter = {
    header: {
      left: [{ type: "text", id: "hl", text: "{{documentTitle}}" }],
      right: [{ type: "text", id: "hr", text: "Page {{pageNumber}} of {{totalPages}}" }],
    },
    footer: {
      center: [{ type: "text", id: "fc", text: "Confidential - {{date}}" }],
    },
  };

  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "Page one content" }] },
    { type: "page-break", id: "pb1" },
    { type: "paragraph", id: "p2", children: [{ type: "text", id: "t2", text: "Page two content" }] },
  );

  const res = paginateDocument(doc);
  assert.equal(res.pages.length, 2);

  // Page 1
  const p1Header = res.pages[0].headerBoxes;
  const p1Footer = res.pages[0].footerBoxes;
  assert(Array.isArray(p1Header));
  assert(Array.isArray(p1Footer));
  assert.equal(p1Header.find((b) => b.type === "header-left")?.content, "Annual Review");
  assert.equal(p1Header.find((b) => b.type === "header-right")?.content, "Page 1 of 2");
  assert(p1Footer.find((b) => b.type === "footer-center")?.content?.startsWith("Confidential -"));

  // Page 2
  const p2Header = res.pages[1].headerBoxes;
  assert.equal(p2Header.find((b) => b.type === "header-left")?.content, "Annual Review");
  assert.equal(p2Header.find((b) => b.type === "header-right")?.content, "Page 2 of 2");
});

test("header-footer: firstPageDifferent handles distinct cover/first page", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.metadata = { title: "Special Report" };
  doc.page.headerFooter = {
    firstPageDifferent: true,
    firstPageHeader: undefined, // Blank header on first page
    firstPageFooter: {
      center: [{ type: "text", id: "fpf", text: "First Page Footer Only" }],
    },
    header: {
      left: [{ type: "text", id: "hl", text: "Standard Header" }],
    },
    footer: {
      center: [{ type: "text", id: "fc", text: "Page {{pageNumber}}" }],
    },
  };

  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "Cover content" }] },
    { type: "page-break", id: "pb1" },
    { type: "paragraph", id: "p2", children: [{ type: "text", id: "t2", text: "Inner content" }] },
  );

  const res = paginateDocument(doc);
  assert.equal(res.pages.length, 2);

  // Page 1 has no header boxes and custom footer
  assert.equal(res.pages[0].headerBoxes.length, 0);
  assert.equal(res.pages[0].footerBoxes[0].content, "First Page Footer Only");

  // Page 2 has standard header and standard footer
  assert.equal(res.pages[1].headerBoxes[0].content, "Standard Header");
  assert.equal(res.pages[1].footerBoxes[0].content, "Page 2");
});

test("header-footer: oddEvenDifferent alternates headers on even pages", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.metadata = { title: "Book Title" };
  doc.page.headerFooter = {
    oddEvenDifferent: true,
    header: {
      right: [{ type: "text", id: "hr", text: "Odd Header Right - {{pageNumber}}" }],
    },
    evenPageHeader: {
      left: [{ type: "text", id: "ehl", text: "{{documentTitle}} - Even Header Left" }],
    },
  };

  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "Page 1" }] },
    { type: "page-break", id: "pb1" },
    { type: "paragraph", id: "p2", children: [{ type: "text", id: "t2", text: "Page 2" }] },
    { type: "page-break", id: "pb2" },
    { type: "paragraph", id: "p3", children: [{ type: "text", id: "t3", text: "Page 3" }] },
  );

  const res = paginateDocument(doc);
  assert.equal(res.pages.length, 3);

  // Page 1 (odd)
  assert.equal(res.pages[0].headerBoxes[0].type, "header-right");
  assert.equal(res.pages[0].headerBoxes[0].content, "Odd Header Right - 1");

  // Page 2 (even)
  assert.equal(res.pages[1].headerBoxes[0].type, "header-left");
  assert.equal(res.pages[1].headerBoxes[0].content, "Book Title - Even Header Left");

  // Page 3 (odd)
  assert.equal(res.pages[2].headerBoxes[0].type, "header-right");
  assert.equal(res.pages[2].headerBoxes[0].content, "Odd Header Right - 3");
});

test("header-footer: PDF layout includes header and footer lines", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.metadata = { title: "PDF Header Test" };
  doc.page.headerFooter = {
    header: {
      left: [{ type: "text", id: "hl", text: "PDF Header Left" }],
      right: [{ type: "text", id: "hr", text: "Page {{pageNumber}}" }],
    },
    footer: {
      center: [{ type: "text", id: "fc", text: "PDF Footer Center" }],
    },
  };

  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "Content in PDF page" }] },
  );

  const pdfPages = buildPdfPages(doc);
  assert.equal(pdfPages.length, 1);

  const hLines = pdfPages[0].lines.filter((l) => l.line.style.startsWith("running-header"));
  const fLines = pdfPages[0].lines.filter((l) => l.line.style.startsWith("running-footer"));

  assert.equal(hLines.length, 2); // left and right
  assert.equal(fLines.length, 1); // center

  const leftText = hLines[0].line.segments.map((s) => (s.kind === "text" ? s.text : "")).join("");
  const rightText = hLines[1].line.segments.map((s) => (s.kind === "text" ? s.text : "")).join("");
  const footerText = fLines[0].line.segments.map((s) => (s.kind === "text" ? s.text : "")).join("");

  assert.equal(leftText, "PDF Header Left");
  assert.equal(rightText, "Page 1");
  assert.equal(footerText, "PDF Footer Center");
});

test("header-footer: PdfWriter emits valid PDF bytes with header and footer", async () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.metadata = { title: "Binary Export Verification" };
  doc.page.headerFooter = {
    header: {
      center: [{ type: "text", id: "hc", text: "Corporate Header" }],
    },
    footer: {
      right: [{ type: "text", id: "fr", text: "Page {{pageNumber}} of {{totalPages}}" }],
    },
  };
  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "Testing PDF writer output stream." }] },
  );

  const writer = new PdfWriter();
  let writtenBytes = new Uint8Array(0);
  const sink = {
    write(chunk) {
      const combined = new Uint8Array(writtenBytes.length + chunk.length);
      combined.set(writtenBytes);
      combined.set(chunk, writtenBytes.length);
      writtenBytes = combined;
    },
    close() {},
  };

  const result = await writer.write(doc, sink);
  assert(result.byteLength > 0);
  assert.equal(result.pages, 1);

  const pdfText = Buffer.from(writtenBytes).toString("latin1");
  assert(pdfText.includes("Corporate Header"));
  assert(pdfText.includes("Page 1 of 1"));
});

test("header-footer: schema validator checks config and zones", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.page.headerFooter = {
    headerDistanceUm: 10000,
    footerDistanceUm: 10000,
    header: {
      left: [{ type: "text", id: "t1", text: "valid" }],
    },
  };
  const validRes = validateDocument(doc, { strict: true });
  assert(validRes.valid);

  // Negative distance fails
  const badDoc = JSON.parse(JSON.stringify(doc));
  badDoc.page.headerFooter.headerDistanceUm = -500;
  const invalidRes = validateDocument(badDoc, { strict: true });
  assert(!invalidRes.valid);
  assert(invalidRes.errors.some((e) => e.code === "range"));
});
