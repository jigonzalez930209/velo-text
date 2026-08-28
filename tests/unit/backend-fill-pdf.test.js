/**
 * Backend fill: frontend {{tags}} → PDF (Express / Vercel / Vite).
 */
import { createDocument, createIdGenerator, createParagraph, createText, createVariable } from "../../dist/public-api/index.js";
import { handlePdfExportJson, expressPdfHandler, vercelPdfHandler, vitePdfPlugin } from "../../dist/adapters/backend/index.js";

function sampleDoc() {
  const g = createIdGenerator("be");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-28T12:00:00.000Z" } });
  doc.root.children = [
    createParagraph(g, [
      createText(g, "Hello "),
      createVariable(g, "name", "{{name}}", { valueType: "string" }),
      createText(g, ", total "),
      createVariable(g, "total", "{{total}}", { valueType: "number" }),
    ]),
  ];
  return doc;
}

function mockRes() {
  const headers = {};
  const out = { statusCode: 200, headers, chunks: [], jsonBody: null };
  return {
    out,
    res: {
      statusCode: 200,
      status(n) { out.statusCode = n; this.statusCode = n; return this; },
      setHeader(k, v) { headers[k] = v; },
      json(b) { out.jsonBody = b; out.chunks.push(Buffer.from(JSON.stringify(b))); },
      send(b) { out.chunks.push(Buffer.isBuffer(b) ? b : Buffer.from(b)); },
      end(b) { if (b) out.chunks.push(Buffer.isBuffer(b) ? b : Buffer.from(String(b))); },
    },
  };
}

test("backend fill: handlePdfExportJson substitutes frontend tags", async () => {
  const r = await handlePdfExportJson({ document: sampleDoc(), data: { name: "Ada", total: 42 } });
  assert(r.status === 200, String(r.error));
  assert(r.bytes[0] === 0x25 && r.bytes[1] === 0x50, "PDF magic");
  const text = new TextDecoder("latin1").decode(r.bytes);
  assert(text.includes("Ada"), "filled name");
  assert(text.includes("42"), "filled total");
  assert(!text.includes("{{name}}"));
});

test("backend fill: missing body is 400", async () => {
  const r = await handlePdfExportJson(null);
  assert(r.status === 400);
});

test("expressPdfHandler POST fills PDF", async () => {
  const { res, out } = mockRes();
  await expressPdfHandler({ method: "POST", body: { document: sampleDoc(), data: { name: "Ada", total: 1 } } }, res);
  assert(out.statusCode === 200);
  const buf = Buffer.concat(out.chunks);
  assert(buf[0] === 0x25 && buf[1] === 0x50);
});

test("expressPdfHandler GET is 405", async () => {
  const { res, out } = mockRes();
  await expressPdfHandler({ method: "GET", body: {} }, res);
  assert(out.statusCode === 405);
});

test("vercelPdfHandler matches express", async () => {
  const { res, out } = mockRes();
  await vercelPdfHandler({ method: "POST", body: { document: sampleDoc(), data: { name: "Ada", total: 7 } } }, res);
  assert(out.statusCode === 200);
  assert(Buffer.concat(out.chunks)[0] === 0x25);
});

test("vitePdfPlugin routes POST /api/pdf", async () => {
  const plugin = vitePdfPlugin("/api/pdf");
  assert(plugin.name === "velo-text-pdf");
  let registered = null;
  plugin.configureServer({
    middlewares: {
      use(fn) { registered = fn; },
    },
  });
  assert(typeof registered === "function");
  const { res, out } = mockRes();
  const listeners = { data: [], end: [] };
  const req = {
    method: "POST",
    url: "/api/pdf",
    on(ev, fn) {
      if (ev === "data" || ev === "end") listeners[ev].push(fn);
    },
  };
  registered(req, res, () => { throw new Error("should not next"); });
  const payload = JSON.stringify({ document: sampleDoc(), data: { name: "Ada", total: 3 } });
  for (const fn of listeners.data) fn(payload);
  for (const fn of listeners.end) fn();
  for (let i = 0; i < 40; i++) {
    const buf = Buffer.concat(out.chunks);
    if (out.statusCode === 200 && buf[0] === 0x25) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  assert(out.statusCode === 200, `status ${out.statusCode} ${out.jsonBody && JSON.stringify(out.jsonBody)}`);
  assert(Buffer.concat(out.chunks)[0] === 0x25);
});
