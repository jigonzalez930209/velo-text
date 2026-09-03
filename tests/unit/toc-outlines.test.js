import { paginateDocument } from "../../dist/export/layout/pagination.js";
import { buildPdfPages } from "../../dist/export/pdf/layout-pages.js";
import { PdfWriter } from "../../dist/export/pdf/writer.js";
import { validateDocument } from "../../dist/core/schema/validator.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("toc: layout generates TOC entries with hierarchical indent and dot leaders", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push(
    {
      type: "table-of-contents",
      id: "toc1",
      maxDepth: 3,
      leaderStyle: "dots",
    },
    { type: "page-break", id: "pb1" },
    {
      type: "heading",
      id: "h1",
      level: 1,
      children: [{ type: "text", id: "th1", text: "Introduction" }],
    },
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "tp1", text: "Intro text" }] },
    {
      type: "heading",
      id: "h2",
      level: 2,
      children: [{ type: "text", id: "th2", text: "Background" }],
    },
    { type: "page-break", id: "pb2" },
    {
      type: "heading",
      id: "h3",
      level: 1,
      children: [{ type: "text", id: "th3", text: "Conclusion" }],
    },
  );

  const res = paginateDocument(doc);
  assert.equal(res.pages.length, 3);

  // Page 1 contains the TOC entries
  const tocBoxes = res.pages[0].boxes.filter((b) => b.type === "toc-entry");
  assert.equal(tocBoxes.length, 3);

  // Check titles and indentation
  assert(tocBoxes[0].content.includes("Introduction"));
  assert.equal(tocBoxes[0].xUm, res.pages[0].boxes[0].xUm); // Level 1 (indent 0)

  assert(tocBoxes[1].content.includes("Background"));
  assert(tocBoxes[1].xUm > tocBoxes[0].xUm); // Level 2 (indented)

  assert(tocBoxes[2].content.includes("Conclusion"));

  // Check resolved page numbers in dot leaders
  assert(tocBoxes[0].content.endsWith("2"), `Expected page 2 for Introduction, got: ${tocBoxes[0].content}`);
  assert(tocBoxes[1].content.endsWith("2"), `Expected page 2 for Background, got: ${tocBoxes[1].content}`);
  assert(tocBoxes[2].content.endsWith("3"), `Expected page 3 for Conclusion, got: ${tocBoxes[2].content}`);
});

test("toc: maxDepth filter excludes deeper heading levels", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push(
    {
      type: "table-of-contents",
      id: "toc1",
      maxDepth: 2,
      leaderStyle: "dots",
    },
    {
      type: "heading",
      id: "h1",
      level: 1,
      children: [{ type: "text", id: "th1", text: "H1 Chapter" }],
    },
    {
      type: "heading",
      id: "h2",
      level: 2,
      children: [{ type: "text", id: "th2", text: "H2 Section" }],
    },
    {
      type: "heading",
      id: "h3",
      level: 3,
      children: [{ type: "text", id: "th3", text: "H3 Subsection" }],
    },
  );

  const res = paginateDocument(doc);
  const tocBoxes = res.pages[0].boxes.filter((b) => b.type === "toc-entry");
  assert.equal(tocBoxes.length, 2);
  assert(tocBoxes[0].content.includes("H1 Chapter"));
  assert(tocBoxes[1].content.includes("H2 Section"));
  assert(!tocBoxes.some((b) => b.content.includes("H3 Subsection")));
});

test("toc: PDF export generates /Outlines bookmarks tree and /Annots links", async () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.metadata = { title: "TOC & Outlines Document" };
  doc.root.children.push(
    {
      type: "table-of-contents",
      id: "toc1",
      maxDepth: 3,
      leaderStyle: "dots",
    },
    { type: "page-break", id: "pb1" },
    {
      type: "heading",
      id: "h1",
      level: 1,
      children: [{ type: "text", id: "th1", text: "Executive Summary" }],
    },
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "tp1", text: "Details here" }] },
    { type: "page-break", id: "pb2" },
    {
      type: "heading",
      id: "h2",
      level: 2,
      children: [{ type: "text", id: "th2", text: "Technical Architecture" }],
    },
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

  await writer.write(doc, sink);
  const pdfText = Buffer.from(writtenBytes).toString("latin1");

  // 1. Check Catalog references /Outlines
  assert(/\/Outlines \d+ 0 R/.test(pdfText), "Catalog must reference /Outlines");

  // 2. Check /Outlines dictionary exists with count
  assert(pdfText.includes("/Type /Outlines"), "Must include /Type /Outlines dictionary");
  assert(pdfText.includes("/Count 2"), "Outlines count must match 2 headings");

  // 3. Check outline items for each heading
  assert(pdfText.includes("/Title (Executive Summary)"), "Must include Executive Summary outline item");
  assert(pdfText.includes("/Title (Technical Architecture)"), "Must include Technical Architecture outline item");
  assert(pdfText.includes("/Dest ["), "Must include /Dest coordinates for headings");

  // 4. Check Page 1 has /Annots with link destinations
  assert(pdfText.includes("/Subtype /Link"), "Must include /Subtype /Link annotations for TOC entries");
});

test("toc: schema validator enforces valid table-of-contents properties", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "table-of-contents",
    id: "toc1",
    maxDepth: 3,
    leaderStyle: "dots",
  });
  const validRes = validateDocument(doc, { strict: true });
  assert(validRes.valid);

  // Invalid maxDepth (out of range 1..6)
  const badDepthDoc = JSON.parse(JSON.stringify(doc));
  badDepthDoc.root.children[0].maxDepth = 7;
  const badDepthRes = validateDocument(badDepthDoc, { strict: true });
  assert(!badDepthRes.valid);
  assert(badDepthRes.errors.some((e) => e.code === "range"));

  // Invalid leaderStyle enum
  const badStyleDoc = JSON.parse(JSON.stringify(doc));
  badStyleDoc.root.children[0].leaderStyle = "wave";
  const badStyleRes = validateDocument(badStyleDoc, { strict: true });
  assert(!badStyleRes.valid);
  assert(badStyleRes.errors.some((e) => e.code === "enum"));
});
