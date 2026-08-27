/**
 * PDF math layout + image decoder tests.
 */
import { parseMath, helveticaWidthPt, pdfLiteralString } from "../../dist/export/pdf/equation.js";
import { decodePngImage, decodeImageForPdf, getInflate, ensureInflateLoaded } from "../../dist/export/pdf/image.js";
import { PdfWriter } from "../../dist/export/pdf/writer.js";
import { validatePdf } from "../../dist/export/validate.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";
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
  assert(total > 500);
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