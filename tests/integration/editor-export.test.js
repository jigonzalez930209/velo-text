/**
 * Integration — editor host round-trip into export validation.
 */
import { JSDOM } from "jsdom";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";
import { createEditor } from "../../dist/editor-web/controller/index.js";
import { exportDocument } from "../../dist/export/index.js";
import { validatePdf } from "../../dist/export/validate.js";

test("integration: insert block then export PDF is valid", async () => {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="ed"></div></body>`, { pretendToBeVisual: true });
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Node = dom.window.Node;
  globalThis.Selection = dom.window.Selection;
  globalThis.Range = dom.window.Range;
  const el = dom.window.document.getElementById("ed");
  const g = createIdGenerator("int");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push({ type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "hello" }] });
  const editor = createEditor(el, { document: doc });
  editor.commands.insertBlock("pageBreak");
  const out = editor.getDocument();
  assert(out.root.children.some((b) => b.type === "page-break"));
  const chunks = [];
  await exportDocument({
    document: out,
    data: {},
    format: "pdf",
    sink: { write: (c) => { chunks.push(c); }, close: () => {} },
    options: { strict: false },
  });
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.length; }
  const errors = validatePdf(bytes).filter((i) => i.severity === "error");
  assert(errors.length === 0, errors.map((e) => e.message).join(", "));
  editor.destroy();
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.Node;
  delete globalThis.Selection;
  delete globalThis.Range;
});
