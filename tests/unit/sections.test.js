import { paginateDocument } from "../../dist/export/layout/pagination.js";
import { buildPdfPages } from "../../dist/export/pdf/layout-pages.js";
import { PdfWriter } from "../../dist/export/pdf/writer.js";
import { normalizeDocument } from "../../dist/core/normalize/normalize.js";
import { validateDocument } from "../../dist/core/schema/validator.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("sections: 3-section document (Portrait -> Landscape -> Portrait) layout", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  // Default is A4 Portrait: 210000 x 297000 um
  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "Section 1 - Portrait" }] },
    {
      type: "section-break",
      id: "sb1",
      settings: { orientation: "landscape" },
    },
    { type: "paragraph", id: "p2", children: [{ type: "text", id: "t2", text: "Section 2 - Landscape" }] },
    {
      type: "section-break",
      id: "sb2",
      settings: { orientation: "portrait" },
    },
    { type: "paragraph", id: "p3", children: [{ type: "text", id: "t3", text: "Section 3 - Back to Portrait" }] },
  );

  const res = paginateDocument(doc);
  assert.equal(res.pages.length, 3);

  // Page 1: Portrait (width < height)
  assert(res.pages[0].widthUm < res.pages[0].heightUm, "Page 1 should be portrait");
  assert.equal(res.pages[0].widthUm, 210000);
  assert.equal(res.pages[0].heightUm, 297000);

  // Page 2: Landscape (width > height)
  assert(res.pages[1].widthUm > res.pages[1].heightUm, "Page 2 should be landscape");
  assert.equal(res.pages[1].widthUm, 297000);
  assert.equal(res.pages[1].heightUm, 210000);

  // Page 3: Portrait (width < height)
  assert(res.pages[2].widthUm < res.pages[2].heightUm, "Page 3 should be portrait");
  assert.equal(res.pages[2].widthUm, 210000);
  assert.equal(res.pages[2].heightUm, 297000);
});

test("sections: wide table in landscape section occupies full available width", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  const cols = Array.from({ length: 6 }, (_, i) => ({ id: `col_${i}`, widthUm: 40000 }));
  const cells = Array.from({ length: 6 }, (_, i) => ({
    id: `cell_${i}`,
    colSpan: 1,
    rowSpan: 1,
    blocks: [{ type: "paragraph", id: `cp_${i}`, children: [{ type: "text", id: `ct_${i}`, text: `Col ${i}` }] }],
  }));

  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "Portrait content" }] },
    {
      type: "section-break",
      id: "sb1",
      settings: { orientation: "landscape" },
    },
    {
      type: "table",
      id: "tbl1",
      columns: cols,
      rows: [{ id: "r1", header: true, cells }],
    },
  );

  const pdfPages = buildPdfPages(doc);
  assert.equal(pdfPages.length, 2);

  // Portrait page (A4 ~ 595 x 842 pt)
  assert.equal(pdfPages[0].widthPt, 595);
  assert.equal(pdfPages[0].heightPt, 842);

  // Landscape page (A4 ~ 842 x 595 pt)
  assert.equal(pdfPages[1].widthPt, 842);
  assert.equal(pdfPages[1].heightPt, 595);

  // In landscape, table lines have cell widths based on landscape width (842 - margins > 595 - margins)
  const cellLines = pdfPages[1].lines.filter((l) => l.line.style.startsWith("table-cell"));
  assert(cellLines.length > 0);
  const parts = cellLines[0].line.style.split(" ");
  const cellWidth = Number(parts[4]);
  // Total table width in landscape: 6 cols * cellWidth
  const totalTableWidth = cellWidth * 6;
  assert(totalTableWidth > 550, `Expected landscape table width > 550 pt, got ${totalTableWidth}`);
});

test("sections: PDF export sets /MediaBox individually per page", async () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "Page 1 Portrait" }] },
    { type: "section-break", id: "sb1", settings: { orientation: "landscape" } },
    { type: "paragraph", id: "p2", children: [{ type: "text", id: "t2", text: "Page 2 Landscape" }] },
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

  // Verify both MediaBoxes exist in PDF object dictionaries
  assert(pdfText.includes("/MediaBox [0 0 595 842]"), "Must include portrait MediaBox");
  assert(pdfText.includes("/MediaBox [0 0 842 595]"), "Must include landscape MediaBox");
});

test("sections: restartPageNumbering resets page numbers in running headers", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.metadata = { title: "Section Numbering Test" };
  doc.page.headerFooter = {
    header: {
      right: [{ type: "text", id: "hr", text: "Page {{pageNumber}}" }],
    },
  };

  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "Intro part 1" }] },
    { type: "page-break", id: "pb1" },
    { type: "paragraph", id: "p2", children: [{ type: "text", id: "t2", text: "Intro part 2" }] },
    {
      type: "section-break",
      id: "sb1",
      settings: { restartPageNumbering: true, startPageNumber: 1 },
    },
    { type: "paragraph", id: "p3", children: [{ type: "text", id: "t3", text: "Body chapter 1" }] },
  );

  const res = paginateDocument(doc);
  assert.equal(res.pages.length, 3);
  assert.equal(res.pages[0].headerBoxes[0].content, "Page 1");
  assert.equal(res.pages[1].headerBoxes[0].content, "Page 2");
  assert.equal(res.pages[2].headerBoxes[0].content, "Page 1"); // Restarted!
});

test("sections: normalizer collapses consecutive section-breaks", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "Text" }] },
    { type: "section-break", id: "sb1", settings: { orientation: "landscape" } },
    { type: "section-break", id: "sb2", settings: { orientation: "portrait", startPageNumber: 5 } },
  );

  const norm = normalizeDocument(doc);
  const sectionBreaks = norm.root.children.filter((b) => b.type === "section-break");
  assert.equal(sectionBreaks.length, 1);
  assert.equal(sectionBreaks[0].settings.orientation, "portrait");
  assert.equal(sectionBreaks[0].settings.startPageNumber, 5);
});

test("sections: schema validator verifies section-break settings", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "section-break",
    id: "sb1",
    settings: { orientation: "landscape", marginsUm: { top: 10000, right: 10000, bottom: 10000, left: 10000 } },
  });
  const resValid = validateDocument(doc, { strict: true });
  assert(resValid.valid);

  // Invalid orientation
  const badDoc1 = JSON.parse(JSON.stringify(doc));
  badDoc1.root.children[0].settings.orientation = "diagonal";
  const resBad1 = validateDocument(badDoc1, { strict: true });
  assert(!resBad1.valid);
  assert(resBad1.errors.some((e) => e.code === "enum"));

  // Negative widthUm
  const badDoc2 = JSON.parse(JSON.stringify(doc));
  badDoc2.root.children[0].settings.widthUm = -100;
  const resBad2 = validateDocument(badDoc2, { strict: true });
  assert(!resBad2.valid);
  assert(resBad2.errors.some((e) => e.code === "range"));
});
