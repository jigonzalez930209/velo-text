import { paginateDocument } from "../../dist/export/layout/pagination.js";
import { renderBlocksToHtml } from "../../dist/editor-web/view/render.js";
import { PdfWriter } from "../../dist/export/pdf/writer.js";
import { validateDocument } from "../../dist/core/schema/validator.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("callouts: layout generates callout-title and callout-line boxes", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "callout",
    id: "co1",
    variant: "tip",
    title: "Pro Tip",
    children: [
      {
        type: "paragraph",
        id: "p1",
        children: [{ type: "text", id: "t1", text: "Use keyboard shortcuts to write faster." }],
      },
      {
        type: "paragraph",
        id: "p2",
        children: [{ type: "text", id: "t2", text: "Another helpful point inside callout." }],
      },
    ],
  });

  const res = paginateDocument(doc);
  assert.equal(res.pages.length, 1);

  const page = res.pages[0];
  const titleBox = page.boxes.find((b) => b.type === "callout-title");
  assert(titleBox, "Must contain callout-title box");
  assert(titleBox.content.includes("PRO TIP") || titleBox.content.includes("Pro Tip"));

  const lineBoxes = page.boxes.filter((b) => b.type === "callout-line");
  assert.equal(lineBoxes.length, 2);
  assert(lineBoxes[0].content.includes("keyboard shortcuts"));
  assert(lineBoxes[1].content.includes("Another helpful point"));
});

test("callouts: web HTML rendering produces semantic aside with variant class", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "callout",
    id: "co_warn",
    variant: "warning",
    title: "Caution Advised",
    children: [
      {
        type: "paragraph",
        id: "p_warn",
        children: [{ type: "text", id: "t_warn", text: "Do not delete production database." }],
      },
    ],
  });

  const html = renderBlocksToHtml(doc);
  assert(html.includes('<aside data-node-id="co_warn" data-node-type="callout" class="pde-callout pde-callout--warning"'), "Must render semantic aside with warning variant");
  assert(html.includes("Caution Advised"), "Must render title");
  assert(html.includes("Do not delete production database"), "Must render children paragraph");
});

test("callouts: PDF export renders callout background and accent border", async () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "callout",
    id: "co_pdf",
    variant: "danger",
    title: "Security Alert",
    children: [
      {
        type: "paragraph",
        id: "p_pdf",
        children: [{ type: "text", id: "t_pdf", text: "API key was revoked." }],
      },
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

  // 1. Verify danger background tint (1.000 0.945 0.949 rg)
  assert(pdfText.includes("1.000 0.945 0.949 rg"), "Must include danger background tint");

  // 2. Verify left accent border (2.5 w and danger stroke RG)
  assert(pdfText.includes("2.5 w") && pdfText.includes("0.957 0.247 0.369 RG"), "Must draw 2.5pt danger accent border");

  // 3. Verify title and content
  assert(pdfText.includes("Security Alert"), "Must render callout title");
  assert(pdfText.includes("API") && pdfText.includes("revoked"), "Must render callout body");
});

test("callouts: schema validator verifies callout variant, title, and children", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "callout",
    id: "co_val",
    variant: "info",
    title: "Important Note",
    children: [
      {
        type: "paragraph",
        id: "p_val",
        children: [{ type: "text", id: "t_val", text: "Valid callout" }],
      },
    ],
  });

  const validRes = validateDocument(doc, { strict: true });
  assert(validRes.valid);

  // Invalid variant
  const badVarDoc = JSON.parse(JSON.stringify(doc));
  badVarDoc.root.children[0].variant = "invalid-variant";
  const badVarRes = validateDocument(badVarDoc, { strict: true });
  assert(!badVarRes.valid);
  assert(badVarRes.errors.some((e) => e.code === "enum"));

  // Non-array children
  const badChildrenDoc = JSON.parse(JSON.stringify(doc));
  badChildrenDoc.root.children[0].children = "not an array";
  const badChildrenRes = validateDocument(badChildrenDoc, { strict: true });
  assert(!badChildrenRes.valid);
  assert(badChildrenRes.errors.some((e) => e.code === "type"));
});
