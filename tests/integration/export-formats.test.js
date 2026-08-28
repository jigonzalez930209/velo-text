/**
 * Integration — exportDocument pdf/odt/docx plus in-memory HTTP export.
 */
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";
import { exportDocument } from "../../dist/export/index.js";
import { validatePdf, validateOdt, validateDocx } from "../../dist/export/validate.js";
import { server as httpApi } from "../../examples/http-api.mjs";

async function collect(format, doc) {
  const chunks = [];
  await exportDocument({
    document: doc,
    data: { name: "Ada" },
    format,
    sink: { write: (c) => { chunks.push(c); }, close: () => {} },
    options: { strict: false, deterministic: true },
  });
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.length; }
  return bytes;
}

test("integration: exportDocument pdf/odt/docx validate", async () => {
  const g = createIdGenerator("xf");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push({ type: "paragraph", id: "p1", children: [
    { type: "text", id: "t1", text: "Hello " },
    { type: "variable", id: "v1", path: "name", source: "{{name}}", valueType: "string" },
  ] });
  const pdf = await collect("pdf", doc);
  const odt = await collect("odt", doc);
  const docx = await collect("docx", doc);
  assert(validatePdf(pdf).filter((i) => i.severity === "error").length === 0);
  assert(validateOdt(odt).filter((i) => i.severity === "error").length === 0);
  assert(validateDocx(docx).filter((i) => i.severity === "error").length === 0);
});

test("integration: HTTP export accepts pdf odt docx", async () => {
  await new Promise((resolve) => httpApi.listen(0, "127.0.0.1", resolve));
  const { port } = httpApi.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const created = await fetch(`${base}/documents`, { method: "POST" });
    assert(created.status === 201, String(created.status));
    const rec = await created.json();
    for (const format of ["pdf", "odt", "docx"]) {
      const res = await fetch(`${base}/documents/${encodeURIComponent(rec.id)}/export?format=${format}`, { method: "POST" });
      assert(res.status === 200, `${format} ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      assert(buf.length > 20, format);
    }
    const bad = await fetch(`${base}/documents/${encodeURIComponent(rec.id)}/export?format=xlsx`, { method: "POST" });
    assert(bad.status === 400);
  } finally {
    await new Promise((resolve, reject) => httpApi.close((e) => (e ? reject(e) : resolve())));
  }
}, { timeout: 15000 });
