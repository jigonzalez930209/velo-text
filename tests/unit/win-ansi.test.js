import {
  findUnmappedPdfChars,
  mapCharToPdfWinAnsi,
  unicodeToWinAnsi,
} from "../../dist/fonts/win-ansi.js";
import { pdfEscape } from "../../dist/export/pdf/pdf-model.js";

test("win-ansi: Spanish and Latin-1 punctuation", () => {
  for (const ch of "Información Niño ¿Sí? ¡Hola! áéíóúñ") {
    if (ch === "?") continue;
    assert(mapCharToPdfWinAnsi(ch) !== 0x3f, ch);
  }
  assert.equal(mapCharToPdfWinAnsi("€"), 0x80);
  assert.equal(mapCharToPdfWinAnsi("—"), 0x97);
  assert.equal(mapCharToPdfWinAnsi("–"), 0x96);
  assert.equal(mapCharToPdfWinAnsi("«"), 0xab);
  assert.equal(mapCharToPdfWinAnsi("»"), 0xbb);
  assert.equal(mapCharToPdfWinAnsi("…"), 0x85);
  assert.equal(mapCharToPdfWinAnsi("©"), 0xa9);
  assert.equal(mapCharToPdfWinAnsi("°"), 0xb0);
  assert.equal(mapCharToPdfWinAnsi("½"), 0xbd);
});

test("win-ansi: common fallbacks and strips", () => {
  assert.equal(mapCharToPdfWinAnsi("\t"), 0x20);
  assert.equal(mapCharToPdfWinAnsi("−"), 0x2d);
  assert.equal(mapCharToPdfWinAnsi("―"), 0x97);
  assert.equal(mapCharToPdfWinAnsi("‒"), 0x96);
  assert.equal(mapCharToPdfWinAnsi("⁄"), 0x2f);
  assert.equal(mapCharToPdfWinAnsi("µ"), 0xb5);
  assert.equal(mapCharToPdfWinAnsi("μ"), 0xb5);
  assert.equal(mapCharToPdfWinAnsi("₹"), 0x24);
  assert.equal(mapCharToPdfWinAnsi("№"), 0x4e);
  assert.equal(mapCharToPdfWinAnsi("\u200b"), null);
  assert.equal(mapCharToPdfWinAnsi("\r"), null);
  assert.equal(mapCharToPdfWinAnsi("\u0301"), null);
  assert(mapCharToPdfWinAnsi("é") !== 0x3f);
});

test("win-ansi: unmapped chars flagged for diagnostics", () => {
  const missing = findUnmappedPdfChars("hello 😀 中文 ∑");
  assert(missing.includes("😀"));
  assert(missing.includes("中"));
  assert(missing.includes("∑"));
  assert.equal(findUnmappedPdfChars("Información — Niño").length, 0);
});

test("win-ansi: pdfEscape skips invisible chars", () => {
  const escaped = pdfEscape("a\u200bb");
  assert.equal(escaped, "ab");
  assert(!escaped.includes("?"));
});

test("win-ansi: Latin-1 direct mapping", () => {
  assert.equal(unicodeToWinAnsi(0xa0), 0x20);
  for (let cp = 161; cp <= 255; cp++) {
    assert.equal(unicodeToWinAnsi(cp), cp);
  }
});
