import { createDocument, createIdGenerator, createParagraph, createText, createEquation, createTable } from "../../dist/core/model/factories.js";
import { applyPreset, shadeCell } from "../../dist/core/model/table-look.js";
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

test("pdf: list-header fills match editor hex (no gray+white header)", async () => {
  const g = createIdGenerator("pdfth");
  const clock = { nowIso: () => "2026-08-28T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: g, clock });
  const tbl = createTable(g, 2, 2);
  applyPreset(tbl, "list-header");
  tbl.rows[0].cells[0].blocks[0].children[0].text = "Lote";
  tbl.rows[1].cells[0].blocks[0].children[0].text = "Cliente";
  doc.root.children.push(tbl);
  const a = await exportPdf({ document: doc, data: {}, options: { strict: false }, clock });
  const text = new TextDecoder().decode(a.bytes);
  assert(text.includes("0.082 0.502 0.239 rg"), "header #15803d");
  assert(text.includes("0.925 0.992 0.961 rg"), "first-col #ecfdf5");
  assert(!text.includes("0.95 0.95 0.97 rg"), "no gray fill fallback");
});

test("pdf: custom cell fill rgb() becomes office hex in the stream", async () => {
  const g = createIdGenerator("pdfcell");
  const clock = { nowIso: () => "2026-08-28T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: g, clock });
  const tbl = createTable(g, 1, 1);
  shadeCell(tbl.rows[0].cells[0], "rgb(255, 0, 0)");
  tbl.rows[0].cells[0].blocks[0].children[0].text = "X";
  doc.root.children.push(tbl);
  const a = await exportPdf({ document: doc, data: {}, options: { strict: false }, clock });
  const text = new TextDecoder().decode(a.bytes);
  assert(text.includes("1.000 0.000 0.000 rg"), "red cell fill");
});

test("pdf: header cell keeps custom text color instead of forcing white", async () => {
  const g = createIdGenerator("pdfhdrfg");
  const clock = { nowIso: () => "2026-08-28T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: g, clock });
  const tbl = createTable(g, 2, 2);
  applyPreset(tbl, "list-header");
  tbl.rows[0].cells[0].blocks[0].children[0].text = "Lote";
  tbl.rows[0].cells[1].blocks[0].children[0].text = "LOT";
  tbl.rows[0].cells[1].blocks[0].children[0].marks = { color: "#ff0000", bold: true };
  tbl.rows[1].cells[0].blocks[0].children[0].text = "Cliente";
  doc.root.children.push(tbl);
  const a = await exportPdf({ document: doc, data: {}, options: { strict: false }, clock });
  const text = new TextDecoder().decode(a.bytes);
  assert(text.includes("0.082 0.502 0.239 rg"), "header fill");
  assert(text.includes("1.000 0.000 0.000 rg"), "red header text");
  assert(text.includes("1.000 1.000 1.000 rg"), "unmarked header text stays white");
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
  assert(text.includes("/Fb 18 Tf"), text.slice(text.indexOf("stream"), text.indexOf("stream") + 400));
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

test("exportPdf: Spanish accents use WinAnsi with full font widths", async () => {
  const g = createIdGenerator("pdfes");
  const clock = { nowIso: () => "2026-08-28T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: g, clock });
  doc.root.children.push(createParagraph(g, [
    createText(g, "Información técnica — Niño español ¿Sí? € … «texto» −5"),
  ]));
  const a = await exportPdf({ document: doc, data: {}, options: { strict: false }, clock });
  const text = Buffer.from(a.bytes).toString("latin1");
  const lower = text.toLowerCase();
  assert(lower.includes("\\363") || lower.includes("00f3"), "ó encoded for PDF");
  assert(lower.includes("\\361") || lower.includes("00f1"), "ñ encoded for PDF");
  assert(lower.includes("\\277") || lower.includes("00bf"), "¿ encoded for PDF");
  assert(text.includes("/LastChar 255"), "font Widths cover Latin-1");
  assert(!text.includes("InformaciÃ"), "no UTF-8 mojibake");
  const d = collectPdfDiagnostics(doc, {});
  assert(!d.some((x) => x.code === "pdf-unmapped-char"), JSON.stringify(d));
});

test("collectPdfDiagnostics: unmapped Unicode in plain text", () => {
  const g = createIdGenerator("pdfuni");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-28T12:00:00.000Z" } });
  doc.root.children.push(createParagraph(g, [createText(g, "emoji 😀 and 中文")]));
  const d = collectPdfDiagnostics(doc, {});
  assert(d.some((x) => x.code === "pdf-unmapped-char"), JSON.stringify(d));
});
