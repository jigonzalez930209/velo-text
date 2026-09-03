import { paginateDocument } from "../../dist/export/layout/pagination.js";
import { buildPdfPages } from "../../dist/export/pdf/layout-pages.js";
import { PdfWriter } from "../../dist/export/pdf/writer.js";
import { validateDocument } from "../../dist/core/schema/validator.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("footnotes: inline citation reference accumulates footnote definitions at bottom of page", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.footnotes = {
    fn1: {
      id: "fn1",
      blocks: [
        {
          type: "paragraph",
          id: "fnp1",
          children: [{ type: "text", id: "fnt1", text: "First footnote explanation." }],
        },
      ],
    },
    fn2: {
      id: "fn2",
      blocks: [
        {
          type: "paragraph",
          id: "fnp2",
          children: [{ type: "text", id: "fnt2", text: "Second footnote citation." }],
        },
      ],
    },
  };

  doc.root.children.push(
    {
      type: "paragraph",
      id: "p1",
      children: [
        { type: "text", id: "t1", text: "This statement requires citation" },
        { type: "footnote-ref", id: "fnref1", footnoteId: "fn1" },
        { type: "text", id: "t2", text: " and another point" },
        { type: "footnote-ref", id: "fnref2", footnoteId: "fn2", customMark: "*" },
        { type: "text", id: "t3", text: "." },
      ],
    },
  );

  const res = paginateDocument(doc);
  assert.equal(res.pages.length, 1);

  const page = res.pages[0];
  assert(page.footnoteBoxes && page.footnoteBoxes.length > 0, "Page should have footnoteBoxes");

  // 1. First box is 50mm divider rule (50000 um)
  const divider = page.footnoteBoxes[0];
  assert.equal(divider.type, "footnote-divider");
  assert.equal(divider.widthUm, 50000);

  // 2. Subsequent boxes are footnotes
  assert.equal(page.footnoteBoxes.length, 3); // 1 divider + 2 footnotes
  assert(page.footnoteBoxes[1].content.includes("First footnote explanation"));
  assert(page.footnoteBoxes[2].content.includes("Second footnote citation"));
  assert(page.footnoteBoxes[2].content.startsWith("*"), "Custom mark * should be used");

  // Footnote boxes are placed at the bottom of the page
  assert(divider.yUm > page.boxes[0].yUm, "Divider should be below content");
  assert(page.footnoteBoxes[1].yUm > divider.yUm, "Footnote 1 should be below divider");
});

test("footnotes: height reservation pushes triggering line and footnote to next page when overflowing", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.footnotes = {
    fn_overflow: {
      id: "fn_overflow",
      blocks: [
        {
          type: "paragraph",
          id: "fnp_ov",
          children: [{ type: "text", id: "fnt_ov", text: "Footnote definition for overflow test." }],
        },
      ],
    },
  };

  // Fill page close to the bottom boundary with many paragraphs
  for (let i = 0; i < 45; i++) {
    doc.root.children.push({
      type: "paragraph",
      id: `filler_${i}`,
      children: [{ type: "text", id: `ft_${i}`, text: `Filler paragraph line ${i}` }],
    });
  }

  // Add triggering line with footnote that won't fit on page 1
  doc.root.children.push({
    type: "paragraph",
    id: "trigger_para",
    children: [
      { type: "text", id: "trig_text", text: "This final paragraph overflows because of footnote space" },
      { type: "footnote-ref", id: "trig_fn", footnoteId: "fn_overflow" },
    ],
  });

  const res = paginateDocument(doc);
  assert(res.pages.length >= 2, "Should create at least 2 pages");

  // Page 2 should contain the trigger paragraph and the footnote definition
  const page2 = res.pages[1];
  const page2HasTrigger = page2.boxes.some((b) => b.content && b.content.includes("This final paragraph overflows"));
  assert(page2HasTrigger, "Trigger paragraph should be pushed to page 2");
  assert(page2.footnoteBoxes && page2.footnoteBoxes.length > 0, "Footnote should be placed on page 2");
});

test("footnotes: PDF export draws 50mm divider rule and prints footnote text", async () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.footnotes = {
    fn1: {
      id: "fn1",
      blocks: [
        {
          type: "paragraph",
          id: "fnp1",
          children: [{ type: "text", id: "fnt1", text: "Important footnote citation." }],
        },
      ],
    },
  };
  doc.root.children.push({
    type: "paragraph",
    id: "p1",
    children: [
      { type: "text", id: "t1", text: "Referenced text" },
      { type: "footnote-ref", id: "fnr1", footnoteId: "fn1" },
    ],
  });

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

  // 1. Verify 50mm divider rule stroke is drawn
  assert(pdfText.includes("0.4 0.4 0.4 RG"), "Must include divider rule stroke");

  // 2. Verify footnote text is rendered in PDF stream
  assert(pdfText.includes("Important footnote citation"), "Must include footnote text in PDF");
});

test("footnotes: schema validator verifies footnote-ref and document footnotes", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.footnotes = {
    fn1: {
      id: "fn1",
      blocks: [
        {
          type: "paragraph",
          id: "p_fn",
          children: [{ type: "text", id: "t_fn", text: "Valid footnote" }],
        },
      ],
    },
  };
  doc.root.children.push({
    type: "paragraph",
    id: "p1",
    children: [
      { type: "text", id: "t1", text: "Text" },
      { type: "footnote-ref", id: "fnr1", footnoteId: "fn1", customMark: "†" },
    ],
  });

  const validRes = validateDocument(doc, { strict: true });
  assert(validRes.valid);

  // Missing footnoteId
  const badFnRefDoc = JSON.parse(JSON.stringify(doc));
  delete badFnRefDoc.root.children[0].children[1].footnoteId;
  const badFnRefRes = validateDocument(badFnRefDoc, { strict: true });
  assert(!badFnRefRes.valid);
  assert(badFnRefRes.errors.some((e) => e.code === "required"));

  // Footnote key mismatch
  const badMismatchDoc = JSON.parse(JSON.stringify(doc));
  badMismatchDoc.footnotes.fn1.id = "fn2";
  const badMismatchRes = validateDocument(badMismatchDoc, { strict: true });
  assert(!badMismatchRes.valid);
  assert(badMismatchRes.errors.some((e) => e.code === "id-mismatch"));
});
