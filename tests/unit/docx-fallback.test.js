import { placeholderPng, needsRasterFallback } from "../../dist/assets/png/placeholder.js";
import { DocxWriter } from "../../dist/export/docx/writer.js";
import { createDocument, createIdGenerator, createImageBlock } from "../../dist/core/model/factories.js";

test("png placeholder is a PNG signature", () => {
  const b = placeholderPng();
  assert(b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47);
  assert(needsRasterFallback("image/svg+xml"));
  assert(needsRasterFallback("image/webp"));
  assert(!needsRasterFallback("image/png"));
});

test("docx writer adds png fallback for svg assets", async () => {
  const g = createIdGenerator("d");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.assets.svg1 = { id: "svg1", kind: "image", mediaType: "image/svg+xml", storageKey: "k", sha256: "a".repeat(64), byteLength: 10, alt: "s" };
  doc.root.children.push(createImageBlock(g, "svg1", { alt: "s", widthUm: 20000 }));
  const chunks = [];
  const writer = new DocxWriter({ clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  await writer.write(doc, { svg1: { id: "svg1", mediaType: "image/svg+xml", data: new TextEncoder().encode("<svg/>") } }, {
    write(c) { chunks.push(c); },
    close() {},
  });
  const bytes = chunks[0];
  const asText = new TextDecoder("latin1").decode(bytes);
  assert(asText.includes("svg1.png") || asText.includes("media/svg1.png"));
});
