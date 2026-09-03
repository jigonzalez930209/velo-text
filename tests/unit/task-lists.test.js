import { paginateDocument } from "../../dist/export/layout/pagination.js";
import { renderBlocksToHtml } from "../../dist/editor-web/view/render.js";
import { PdfWriter } from "../../dist/export/pdf/writer.js";
import { validateDocument } from "../../dist/core/schema/validator.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";

test("task-lists: layout generates [x] and [ ] prefixes for checklist items", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "list",
    id: "l1",
    kind: "unordered",
    items: [
      {
        id: "item_done",
        checked: true,
        content: [{ type: "text", id: "t1", text: "Finished task item" }],
      },
      {
        id: "item_pending",
        checked: false,
        content: [{ type: "text", id: "t2", text: "Pending task item" }],
      },
    ],
  });

  const res = paginateDocument(doc);
  assert.equal(res.pages.length, 1);

  const page = res.pages[0];
  const listLines = page.boxes.filter((b) => b.type === "list-item");
  assert.equal(listLines.length, 2);
  assert(listLines[0].content.startsWith("[x]"), "Completed item should have [x] prefix");
  assert(listLines[1].content.startsWith("[ ]"), "Pending item should have [ ] prefix");
});

test("task-lists: web HTML rendering emits interactive checkbox input elements", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "list",
    id: "l_html",
    kind: "unordered",
    items: [
      {
        id: "task1",
        checked: true,
        content: [{ type: "text", id: "t1", text: "Verified bug fix" }],
      },
      {
        id: "task2",
        checked: false,
        content: [{ type: "text", id: "t2", text: "Deploy to staging" }],
      },
    ],
  });

  const html = renderBlocksToHtml(doc);
  assert(html.includes('class="pde-task-item"'), "Must include pde-task-item class on li");
  assert(html.includes('type="checkbox" class="pde-task-checkbox" data-task-item-id="task1" checked'), "Must render checked input for task1");
  assert(html.includes('type="checkbox" class="pde-task-checkbox" data-task-item-id="task2">'), "Must render unchecked input for task2");
});

test("task-lists: PDF export renders vector square and checkmark", async () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "list",
    id: "l_pdf",
    kind: "unordered",
    items: [
      {
        id: "t_done",
        checked: true,
        content: [{ type: "text", id: "t1", text: "Checked item" }],
      },
      {
        id: "t_undone",
        checked: false,
        content: [{ type: "text", id: "t2", text: "Unchecked item" }],
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

  // 1. Verify vector checkbox square (10.00 10.00 re S)
  assert(pdfText.includes("10.00 10.00 re S"), "Must render vector checkbox square");

  // 2. Verify checkmark line stroke (0.1 0.6 0.2 RG)
  assert(pdfText.includes("0.1 0.6 0.2 RG"), "Must render checkmark stroke for checked task");

  // 3. Verify task text in PDF stream
  assert(pdfText.includes("Checked") && pdfText.includes("Unchecked"), "Must render task labels");
});

test("task-lists: schema validator validates checked boolean property", () => {
  const doc = createDocument({ idGenerator: createIdGenerator("t") });
  doc.root.children.push({
    type: "list",
    id: "l_val",
    kind: "unordered",
    items: [
      {
        id: "it1",
        checked: true,
        content: [{ type: "text", id: "t1", text: "Valid task" }],
      },
    ],
  });

  const validRes = validateDocument(doc, { strict: true });
  assert(validRes.valid);

  // Non-boolean checked property
  const badDoc = JSON.parse(JSON.stringify(doc));
  badDoc.root.children[0].items[0].checked = "true";
  const badRes = validateDocument(badDoc, { strict: true });
  assert(!badRes.valid);
  assert(badRes.errors.some((e) => e.code === "type"));
});
