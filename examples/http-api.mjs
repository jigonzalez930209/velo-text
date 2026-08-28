#!/usr/bin/env node
/**
 * HTTP document API — Phase 10.2 using in-memory repo (no pg driver).
 * POST /documents/:id/export?format=pdf  — same `exportPdf` as playground preview (do not fork a second generator).
 * Hosts (Express / Vercel): `const { bytes } = await exportPdf({ document, data, assets, options: { strict: false } })`
 */
import http from "node:http";
import { createDocument, createIdGenerator, exportDocument, validateDocument, normalizeDocument } from "../dist/public-api/index.js";
import { createInMemoryRepository } from "../dist/adapters/postgres-contract/index.js";
import { createBufferSink } from "../dist/adapters/backend/index.js";

const MIME = {
  pdf: "application/pdf",
  odt: "application/vnd.oasis.opendocument.text",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const repo = createInMemoryRepository();
const TENANT = "demo";
const PORT = Number(process.env.PORT ?? 8787);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res, code, body, headers = {}) {
  const data = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(code, { "content-type": typeof body === "string" ? "text/plain" : "application/json", ...headers });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1`);
  try {
    if (req.method === "POST" && url.pathname === "/documents") {
      const g = createIdGenerator("api");
      const doc = createDocument({ idGenerator: g, clock: { nowIso: () => new Date().toISOString() } });
      const rec = await repo.create(doc, TENANT, { idempotencyKey: req.headers["idempotency-key"] });
      return send(res, 201, rec);
    }
    const m = url.pathname.match(/^\/documents\/([^/]+)(\/export)?$/);
    if (!m) return send(res, 404, { error: "not found" });
    const id = decodeURIComponent(m[1]);
    if (m[2] === "/export" && req.method === "POST") {
      const rec = await repo.get(id, TENANT);
      if (!rec) return send(res, 404, { error: "missing" });
      const format = url.searchParams.get("format") ?? "pdf";
      if (!MIME[format]) return send(res, 400, { error: "format must be pdf, odt or docx" });
      const { sink, getBuffer } = createBufferSink();
      await exportDocument({ document: rec.content, data: {}, format, sink, options: { strict: false } });
      const buf = getBuffer();
      res.writeHead(200, { "content-type": MIME[format], "content-length": buf.length });
      return res.end(buf);
    }
    if (req.method === "GET") {
      const rec = await repo.get(id, TENANT);
      return rec ? send(res, 200, rec) : send(res, 404, { error: "missing" });
    }
    if (req.method === "PUT") {
      const rec = await repo.get(id, TENANT);
      if (!rec) return send(res, 404, { error: "missing" });
      const json = JSON.parse(await readBody(req));
      const expected = Number(req.headers["if-match"] ?? rec.currentRevision);
      const next = normalizeDocument(json.document ?? json);
      const v = validateDocument(next);
      if (!v.valid) return send(res, 400, { errors: v.errors });
      const updated = await repo.update(id, TENANT, expected, next);
      return send(res, 200, updated);
    }
    send(res, 405, { error: "method" });
  } catch (e) {
    send(res, e.message?.includes("revision") ? 409 : 500, { error: String(e.message ?? e) });
  }
});

if (process.argv[1]?.endsWith("http-api.mjs")) {
  server.listen(PORT, () => console.log(`portable-doc http://127.0.0.1:${PORT}`));
}

export { server };
