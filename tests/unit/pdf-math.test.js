/**
 * PDF math layout + image decoder tests.
 */
import { parseMath, helveticaWidthPt, pdfLiteralString } from "../../dist/export/pdf/equation.js";
import { decodePngImage, decodeImageForPdf, getInflate, ensureInflateLoaded } from "../../dist/export/pdf/image.js";
import { PdfWriter } from "../../dist/export/pdf/writer.js";
import { buildPdfPages } from "../../dist/export/pdf/layout-pages.js";
import { pageContentStream } from "../../dist/export/pdf/stream.js";
import { validatePdf } from "../../dist/export/validate.js";
import { createDocument, createIdGenerator, createTable, createColumns, createParagraph, createText } from "../../dist/core/model/factories.js";
import zlib from "node:zlib";

test("math: fraction box has runs and rule", () => {
  const m = parseMath("\\frac{a}{b}");
  assert(m.runs.length >= 2, "num + den runs");
  assert(m.rules.length === 1, "fraction bar rule");
  assert(m.widthPt > 0);
  assert(m.ascentPt > 0 && m.descentPt > 0);
});

test("math: sqrt has radical + overline", () => {
  const m = parseMath("\\sqrt{x}");
  const hasRad = m.runs.some((r) => r.font === "Symbol");
  assert(hasRad, "radical glyph via Symbol");
  assert(m.rules.length >= 1, "overline rule");
});

test("math: sup/sub + greek + operators", () => {
  const m = parseMath("x^{2} + \\alpha \\cdot \\beta = \\gamma \\times \\delta");
  const hasGreek = m.runs.some((r) => r.font === "Symbol");
  assert(hasGreek);
  // superscript exists (smaller size run)
  const sizes = new Set(m.runs.map((r) => r.sizePt));
  assert(sizes.size >= 2, "superscript size differs");
});

test("math: sum with limits and integral", () => {
  const m = parseMath("\\sum_{i=0}^{n} i + \\int_{0}^{1} x dx");
  assert(m.runs.some((r) => r.text === "S"), "Sigma via Symbol S");
  assert(m.runs.some((r) => r.text === "\u00F2"), "integral glyph");
});

test("math: plain text widths", () => {
  const w1 = helveticaWidthPt("Hello", 11);
  const w2 = helveticaWidthPt("H", 11);
  assert(w1 > w2);
  assert(helveticaWidthPt("", 11) === 0);
  assert(helveticaWidthPt("\u00FF", 11) > 0, "unknown char falls back");
});

test("math: pdfLiteralString escapes", () => {
  const s = pdfLiteralString("a(b)\\c");
  assert(s === "(a\\(b\\)\\\\c)");
  const sym = pdfLiteralString("\u00F2");
  assert(sym.includes("\\362"), "octal escape for >127");
});

test("math: parseMath handles edge latex", () => {
  const empty = parseMath("");
  assert(empty.widthPt === 0 && empty.runs.length === 0);
  const unknownCmd = parseMath("\\unknown{a}");
  assert(unknownCmd.runs.length >= 1, "unknown command rendered as text");
  const braces = parseMath("{a + b}");
  assert(braces.runs.length >= 1);
  const nested = parseMath("\\frac{\\frac{a}{b}}{c}");
  assert(nested.runs.length >= 2);
  const delim = parseMath("E = mc^{2} \\left[ 100 \\right]");
  const joined = delim.runs.map((r) => r.text).join("");
  assert(!joined.includes("\\left") && !joined.includes("\\right"), joined);
  assert(joined.includes("[") && joined.includes("]"));
});

// ── PNG decoder ──
const RED_1x1_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("png: decode 1x1 with zlib inflate", async () => {
  const inflate = (data) => new Uint8Array(zlib.inflateSync(data));
  const img = await decodePngImage(new Uint8Array(RED_1x1_PNG), inflate);
  assert(img && img.widthPx === 1 && img.heightPx === 1);
  assert(img.rgb && img.rgb.length === 3);
});

test("png: rejects bad input", async () => {
  const inflate = (data) => new Uint8Array(zlib.inflateSync(data));
  assert(await decodePngImage(new Uint8Array([1, 2, 3]), inflate) === null);
  // valid header but corrupt data
  const corrupt = Buffer.from(RED_1x1_PNG);
  corrupt[30] = 0xff;
  const res = await decodePngImage(new Uint8Array(corrupt), inflate);
  // either null or fails gracefully
  assert(res === null || (res.widthPx >= 1));
});

test("png: getInflate resolves in node", async () => {
  const infl = await getInflate();
  assert(infl !== null, "node zlib inflate available");
});

test("png: ensureInflateLoaded resolves", async () => {
  await ensureInflateLoaded();
});

test("png: decodeImageForPdf jpeg passthrough and png decode", async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 10, 74, 70, 73, 70]);
  const j = await decodeImageForPdf(jpeg, "image/jpeg");
  assert(j && j.jpeg && j.jpeg.length === jpeg.length);
  const p = await decodeImageForPdf(new Uint8Array(RED_1x1_PNG), "image/png");
  assert(p && p.rgb);
  const nope = await decodeImageForPdf(new Uint8Array([1]), "image/gif");
  assert(nope === null);
});

// ── PdfWriter end-to-end with equations + image ──
test("pdf: writer renders equations and embeds png", async () => {
  const g = createIdGenerator("pdf");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push(
    { type: "heading", id: g.next(), level: 1, children: [{ type: "text", id: g.next(), text: "T" }] },
    { type: "paragraph", id: g.next(), children: [{ type: "text", id: g.next(), text: "Quadratic: " }, { type: "equation", id: g.next(), latex: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" }] },
    { type: "equation-block", id: g.next(), latex: "\\sum_{i=1}^{n} i" },
    { type: "horizontal-rule", id: g.next() },
  );
  doc.assets["img1"] = { id: "img1", kind: "image", mediaType: "image/png", storageKey: "k", sha256: "a".repeat(64), byteLength: RED_1x1_PNG.length, alt: "x" };
  doc.root.children.push({ type: "image", id: g.next(), assetId: "img1", widthUm: 20000, heightUm: 20000 });

  const chunks = [];
  const sink = { write: (c) => chunks.push(c), close: () => {} };
  const w = new PdfWriter({ clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  await w.write(doc, sink, { img1: { id: "img1", mediaType: "image/png", data: new Uint8Array(RED_1x1_PNG) } });
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.length; }
  const issues = validatePdf(bytes).filter((i) => i.severity === "error");
  assert(issues.length === 0, `pdf errors: ${issues.map((i) => i.message).join("; ")}`);
  const text = new TextDecoder().decode(bytes);
  assert(text.includes("/F2"), "Symbol font registered");
  assert(text.includes("/XObject"), "image XObject");
  assert(text.includes("/F3"), "Helvetica-Oblique for math");
  assert(text.includes(" re B\n"), "math chip box");
  assert(total > 500);
});

test("pdf: image XObject stream is raw DeviceRGB bytes", async () => {
  const { encodePngRgb } = await import("../../dist/export/images/png-encode.js");
  const rgb = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 10, 20, 30]);
  const png = encodePngRgb(rgb, 2, 2);
  const g = createIdGenerator("px");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push({ type: "image", id: g.next(), assetId: "px", widthUm: 20000, heightUm: 20000 });
  const chunks = [];
  await new PdfWriter({ clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } }).write(doc, { write: (c) => chunks.push(c), close: () => {} }, {
    px: { id: "px", mediaType: "image/png", data: png },
  });
  const bytes = concatChunks(chunks);
  const got = extractImageStream(bytes);
  assert(got && got.length === 12);
  assert(got[0] === 255 && got[4] === 255 && got[8] === 255);
  assert(got[9] === 10 && got[10] === 20 && got[11] === 30);
});

function concatChunks(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.length; }
  return bytes;
}

function extractImageStream(pdf) {
  const ascii = (s) => new TextEncoder().encode(s);
  const imgAt = indexOfBytes(pdf, ascii("/Subtype /Image"));
  if (imgAt < 0) return null;
  const streamAt = indexOfBytes(pdf, ascii("stream\n"), imgAt);
  if (streamAt < 0) return null;
  const start = streamAt + 7;
  const lenMatch = new TextDecoder().decode(pdf.subarray(imgAt, streamAt)).match(/\/Length (\d+)/);
  if (!lenMatch) return null;
  return pdf.subarray(start, start + Number(lenMatch[1]));
}

function indexOfBytes(hay, needle, from = 0) {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

test("pdf: table rows share a contiguous grid", () => {
  const g = createIdGenerator("tbl");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  const table = createTable(g, 2, 2);
  table.rows[0].cells[0].blocks[0].children[0].text = "Item";
  table.rows[0].cells[1].blocks[0].children[0].text = "Qty";
  table.rows[1].cells[0].blocks[0].children[0].text = "Widget";
  table.rows[1].cells[1].blocks[0].children[0].text = "233";
  doc.root.children.push(table);
  const pages = buildPdfPages(doc);
  const { stream } = pageContentStream(pages[0], doc, new Map());
  const rects = [...stream.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re S/g)].map((m) => ({
    x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]),
  }));
  assert(rects.length === 4, `expected 4 cell rects, got ${rects.length}`);
  const h = rects[0].h;
  assert(rects.every((r) => r.h === h), "all cells use the same row height");
  const row0Left = rects[0];
  const row1Left = rects[2];
  assert(row0Left.x === row1Left.x, "columns stay aligned");
  assert(Math.abs(row0Left.y - (row1Left.y + row1Left.h)) < 0.01, "no gap between consecutive rows");
  assert(Math.abs(rects[0].w + rects[1].w - 481) < 1, "table uses the full content width");
});

test("pdf: header cells center their text", () => {
  const g = createIdGenerator("th");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  const table = createTable(g, 2, 2);
  table.rows[0].header = true;
  table.rows[0].cells[0].blocks[0].children[0].text = "Item";
  table.rows[0].cells[1].blocks[0].children[0].text = "Qty";
  table.rows[1].cells[0].blocks[0].children[0].text = "Widget";
  doc.root.children.push(table);
  const pages = buildPdfPages(doc);
  const { stream } = pageContentStream(pages[0], doc, new Map());
  const tms = [...stream.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) Tm/g)].map((m) => Number(m[1]));
  assert(tms[0] > 61, `header text should be inset from cell padding, got ${tms[0]}`);
});

test("pdf: inline math stays with preceding words when they fit", () => {
  const g = createIdGenerator("eq");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push({
    type: "paragraph",
    id: g.next(),
    children: [
      { type: "text", id: g.next(), text: "See " },
      { type: "equation", id: g.next(), latex: "E = mc^2" },
      { type: "text", id: g.next(), text: " here." },
    ],
  });
  const pages = buildPdfPages(doc);
  const para = pages[0].lines.filter((l) => l.line.style === "paragraph");
  assert(para.length === 1, `expected one line, got ${para.length}`);
  const kinds = para[0].line.segments.map((s) => s.kind);
  assert(kinds.includes("text") && kinds.includes("math"));
});

test("pdf: missing image placeholder does not crash", async () => {
  const g = createIdGenerator("pdf");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push({ type: "image", id: g.next(), assetId: "nope", widthUm: 20000, heightUm: 20000 });
  const chunks = [];
  const sink = { write: (c) => chunks.push(c), close: () => {} };
  const w = new PdfWriter();
  await w.write(doc, sink, {});
  const total = chunks.reduce((n, c) => n + c.length, 0);
  assert(total > 200);
});

test("pdf: custom columns have no cell borders", () => {
  const g = createIdGenerator("cols");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  const cols = createColumns(g, 2);
  cols.columns[0].blocks = [createParagraph(g, [createText(g, "Left")])];
  cols.columns[1].blocks = [createParagraph(g, [createText(g, "Right")])];
  doc.root.children.push(cols);
  const pages = buildPdfPages(doc);
  const { stream } = pageContentStream(pages[0], doc, new Map());
  assert(!/re S/.test(stream), "column layout must not stroke boxes");
  assert(stream.includes("Left") && stream.includes("Right"));
});