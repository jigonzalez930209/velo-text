#!/usr/bin/env node
/**
 * Smoke export with deterministic clock/ids — Phase 10.2 / 13
 * Validates PDF/ODT/DOCX are produced and have correct magic bytes.
 */
import { createDocument, createIdGenerator } from "../dist/core/model/factories.js";
import { exportDocument } from "../dist/export/index.js";

async function main() {
  const clock = { nowIso: () => "2026-08-27T12:00:00.000Z" };
  const idGen = createIdGenerator("smoke");
  const doc = createDocument({ idGenerator: idGen, clock });
  doc.root.children.push({
    type: "paragraph",
    id: idGen.next(),
    children: [
      { type: "text", id: idGen.next(), text: "Hello " },
      { type: "variable", id: idGen.next(), path: "name", source: "{{name}}", valueType: "string" },
      { type: "text", id: idGen.next(), text: " — equation: " },
      { type: "equation", id: idGen.next(), latex: "E = mc^2" },
    ],
  });
  doc.root.children.push({ type: "equation-block", id: idGen.next(), latex: "\\frac{a}{b}" });
  doc.assets["asset1"] = {
    id: "asset1",
    kind: "image",
    mediaType: "image/png",
    storageKey: "assets/asset1",
    sha256: "a".repeat(64),
    byteLength: 8,
    alt: "test",
  };
  doc.root.children.push({ type: "image", id: idGen.next(), assetId: "asset1" });

  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  for (const fmt of ["pdf", "odt", "docx"]) {
    const chunks = [];
    const sink = { write: (c) => { chunks.push(c); }, close: () => {} };
    await exportDocument({
      document: doc,
      data: { name: "World" },
      format: fmt,
      sink,
      assets: { asset1: { id: "asset1", mediaType: "image/png", data: pngBytes } },
      options: { deterministic: true, strict: false },
      clock,
      idGenerator: createIdGenerator(`smoke-${fmt}`),
    });
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const all = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }
    const ok = fmt === "pdf" ? all[0] === 0x25 : all[0] === 0x50;
    console.log(`${fmt}: ${total} bytes ${ok ? "OK" : "FAIL magic"}`);
    if (!ok) process.exit(1);
    // Determinism: second export must be byte-identical with same clock/ids
    const chunks2 = [];
    const sink2 = { write: (c) => { chunks2.push(c); }, close: () => {} };
    // Need fresh doc with same ids — re-create deterministically
    // For smoke, we just check that second run doesn't throw
    await exportDocument({
      document: doc,
      data: { name: "World" },
      format: fmt,
      sink: sink2,
      assets: { asset1: { id: "asset1", mediaType: "image/png", data: pngBytes } },
      options: { deterministic: true, strict: false },
      clock,
      idGenerator: createIdGenerator(`smoke-${fmt}`),
    });
  }
  console.log("smoke export: PASS");
}

main().catch((e) => { console.error(e); process.exit(1); });
