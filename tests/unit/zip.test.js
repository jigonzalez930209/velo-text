import { ZipWriter } from "../../dist/export/zip/zipWriter.js";
import { crc32 } from "../../dist/export/zip/crc32.js";

test("zip: STORE produces valid PK header", async () => {
  const zip = new ZipWriter();
  zip.add("mimetype", "application/vnd.oasis.opendocument.text", { method: 0 });
  zip.add("content.xml", "<xml>hello</xml>");
  const bytes = zip.build();
  assert(bytes[0] === 0x50 && bytes[1] === 0x4b, "missing PK");
  // mimetype must be first entry and STORE
  const text = new TextDecoder().decode(bytes.slice(0, 200));
  assert(text.includes("mimetype"));
});

test("zip: crc32 deterministic", () => {
  const a = new TextEncoder().encode("hello");
  const b = new TextEncoder().encode("hello");
  assert.equal(crc32(a), crc32(b));
  const c = new TextEncoder().encode("world");
  assert(crc32(a) !== crc32(c));
});

test("zip: deterministic with fixed mtime", () => {
  const mtime = new Date("2026-08-27T12:00:00.000Z");
  const zip1 = new ZipWriter();
  zip1.add("a.txt", "hello", { mtime });
  const zip2 = new ZipWriter();
  zip2.add("a.txt", "hello", { mtime });
  const b1 = zip1.build();
  const b2 = zip2.build();
  assert.equal(b1.length, b2.length);
  for (let i = 0; i < b1.length; i++) assert(b1[i] === b2[i], `byte ${i} differs`);
});
