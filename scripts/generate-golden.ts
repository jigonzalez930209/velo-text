#!/usr/bin/env node
/**
 * Generate golden files for conformance — Phase 8.2.3 / 9.2.3
 * For each fixture, export to PDF/ODT/DOCX and store normalized XML / hash.
 * Deterministic: uses fixed clock and IDs.
 */
import fs from "node:fs";
import path from "node:path";
import { exportDocument } from "../dist/export/index.js";
import { normalizeXml } from "../dist/export/validate.js";

const fixturesDir = "tests/fixtures";
const goldenDir = "tests/conformance/golden";
fs.mkdirSync(goldenDir, { recursive: true });

const fixtures = fs.readdirSync(fixturesDir).filter((f) => f.endsWith(".json")).sort().slice(0, 5); // first 5 for demo

for (const fixture of fixtures) {
  const doc = JSON.parse(fs.readFileSync(path.join(fixturesDir, fixture), "utf8"));
  for (const fmt of ["pdf", "odt", "docx"] as const) {
    const chunks: Uint8Array[] = [];
    const sink = { write: (c: Uint8Array) => { chunks.push(c); }, close: () => {} };
    await exportDocument({
      document: doc,
      data: {},
      format: fmt,
      sink,
      options: { deterministic: true, strict: false },
    });
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const bytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { bytes.set(c, off); off += c.length; }
    // For golden, store hash and first 1KB of XML for ODT/DOCX
    const hash = Buffer.from(bytes).toString("hex").slice(0, 16);
    const base = fixture.replace(".json", "");
    const outPath = path.join(goldenDir, `${base}.${fmt}.golden`);
    if (fmt === "pdf") {
      fs.writeFileSync(outPath, `hash:${hash}\nsize:${bytes.length}\nheader:${new TextDecoder().decode(bytes.slice(0, 20))}\n`);
    } else {
      // Extract XML snippet for normalization
      const text = new TextDecoder().decode(bytes.slice(0, 5000));
      const normalized = normalizeXml(text.slice(0, 2000));
      fs.writeFileSync(outPath, `hash:${hash}\nsize:${bytes.length}\nnormalized:${normalized.slice(0, 500)}\n`);
    }
    console.log(`golden ${base}.${fmt} -> ${bytes.length} bytes hash ${hash}`);
  }
}
console.log("Golden generation done");
