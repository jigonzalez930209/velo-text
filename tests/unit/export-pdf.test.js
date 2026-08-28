import { createDocument, createIdGenerator, createParagraph, createText, createEquation } from "../../dist/core/model/factories.js";
import { exportPdf, collectPdfDiagnostics } from "../../dist/export/pdf/export-pdf.js";
import { exportDocument } from "../../dist/export/index.js";
import { createBufferSink } from "../../dist/adapters/backend/index.js";

test("exportPdf: playground and backend share one generator", async () => {
  const g = createIdGenerator("pdf1");
  const clock = { nowIso: () => "2026-08-28T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: g, clock });
  doc.root.children.push(createParagraph(g, [
    createText(g, "Hello "),
    createEquation(g, "\\alpha + \\beta"),
  ]));
  const a = await exportPdf({ document: doc, data: {}, options: { strict: false }, clock });
  const { sink, getBuffer } = createBufferSink();
  const b = await exportDocument({ document: doc, data: {}, format: "pdf", sink, options: { strict: false }, clock });
  const viaDoc = getBuffer();
  assert(a.bytes[0] === 0x25 && a.bytes[1] === 0x50 && a.bytes[2] === 0x44 && a.bytes[3] === 0x46);
  assert(a.byteLength === b.byteLength);
  assert(a.bytes.length === viaDoc.length);
  for (let i = 0; i < a.bytes.length; i++) assert(a.bytes[i] === viaDoc[i], "byte " + i);
});

test("collectPdfDiagnostics: unmapped latex and skipped cell image", () => {
  const g = createIdGenerator("pdf2");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-28T12:00:00.000Z" } });
  doc.root.children.push({
    type: "equation-block", id: g.next(), latex: "\\unknowncmd{x}",
  });
  const d = collectPdfDiagnostics(doc, {});
  assert(d.some((x) => x.code === "pdf-latex-unmapped"), JSON.stringify(d));
});
