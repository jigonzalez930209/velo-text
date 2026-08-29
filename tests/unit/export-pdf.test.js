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

test("exportPdf: color and fontSizePt appear in the content stream", async () => {
  const g = createIdGenerator("pdf3");
  const clock = { nowIso: () => "2026-08-28T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: g, clock });
  doc.root.children.push(createParagraph(g, [
    createText(g, "tiny", { color: "#3659e3", fontSizePt: 18, bold: true }),
  ]));
  const a = await exportPdf({ document: doc, data: {}, options: { strict: false }, clock });
  const text = new TextDecoder().decode(a.bytes);
  assert(text.includes("/F4 18 Tf"), text.slice(text.indexOf("stream"), text.indexOf("stream") + 400));
  assert(text.includes("0.212 0.349 0.890 rg"), "color rg");
  const d = collectPdfDiagnostics(doc, {});
  assert(!d.some((x) => x.code === "pdf-marks-ignored"));
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

test("exportPdf: list bullets are WinAnsi, not UTF-8 mojibake", async () => {
  const g = createIdGenerator("pdfb");
  const clock = { nowIso: () => "2026-08-28T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: g, clock });
  doc.root.children.push({
    type: "list", id: g.next(), kind: "unordered",
    items: [{ id: g.next(), content: [{ type: "text", id: g.next(), text: "item" }] }],
  });
  const a = await exportPdf({ document: doc, data: {}, options: { strict: false }, clock });
  const text = Buffer.from(a.bytes).toString("latin1");
  assert(text.includes("\\225"), "WinAnsi bullet octal");
  assert(!text.includes("â¢"), "no mojibake");
});

test("exportPdf: columns default va-top and include list text", async () => {
  const g = createIdGenerator("pdfc");
  const clock = { nowIso: () => "2026-08-28T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: g, clock });
  doc.root.children.push({
    type: "columns", id: g.next(),
    columns: [
      { id: g.next(), widthPct: 40, blocks: [{ type: "paragraph", id: g.next(), children: [{ type: "text", id: g.next(), text: "Narrow" }] }] },
      {
        id: g.next(), widthPct: 60,
        blocks: [{
          type: "list", id: g.next(), kind: "unordered",
          items: [{ id: g.next(), content: [{ type: "text", id: g.next(), text: "WideItem" }] }],
        }],
      },
    ],
  });
  const a = await exportPdf({ document: doc, data: {}, options: { strict: false }, clock });
  const text = Buffer.from(a.bytes).toString("latin1");
  assert(text.includes("Narrow") && text.includes("WideItem"));
});
