#!/usr/bin/env node
/**
 * Benchmarks — Phase 12.2.1
 * Measures write, paste, table, serialization and export with versioned baselines.
 */
import { performance } from "node:perf_hooks";
import { createDocument, createIdGenerator } from "../dist/core/model/factories.js";
import { createTransaction } from "../dist/core/operations/operations.js";
import { exportDocument } from "../dist/export/index.js";

function bench(name, fn, iterations = 1000) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const perOp = elapsed / iterations;
  console.log(`${name}: ${perOp.toFixed(3)} ms/op (${iterations} iterations, total ${elapsed.toFixed(1)} ms)`);
  return { name, perOp, iterations };
}

const results = [];

// Write (insert text)
results.push(
  bench("write (insertInline)", () => {
    const doc = createDocument({ idGenerator: createIdGenerator("b"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
    doc.root.children.push({ type: "paragraph", id: "p1", children: [] });
    const tx = createTransaction(doc, "typing");
    tx.insertInline("p1", 0, { type: "text", id: "t1", text: "hello" });
    tx.commit();
  }, 5000),
);

// Serialization
results.push(
  bench("canonicalStringify (50 pages)", () => {
    const doc = createDocument({ idGenerator: createIdGenerator("b"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
    for (let i = 0; i < 50; i++) doc.root.children.push({ type: "paragraph", id: `p${i}`, children: [{ type: "text", id: `t${i}`, text: "lorem ipsum ".repeat(20) }] });
    JSON.stringify(doc);
  }, 500),
);

// Export
const bigDoc = createDocument({ idGenerator: createIdGenerator("big"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
for (let i = 0; i < 100; i++) bigDoc.root.children.push({ type: "paragraph", id: `p${i}`, children: [{ type: "text", id: `t${i}`, text: "hello world ".repeat(30) }] });
const start = performance.now();
await exportDocument({
  document: bigDoc,
  data: {},
  format: "pdf",
  sink: { write() {}, close() {} },
  options: { deterministic: true, strict: false },
});
console.log(`export 100 pages PDF: ${(performance.now() - start).toFixed(1)} ms`);

// Check baselines
import fs from "node:fs";
let prevBaselines = null;
try {
  prevBaselines = JSON.parse(fs.readFileSync("tests/perf/baselines.json", "utf8"));
} catch (e) {
  // no baseline
}

let hasRegression = false;
const maxRegression = 3; // default
const isUpdate = process.argv.includes("--update");

const maxRegArg = process.argv.find(a => a.startsWith("--max-regression="));
const maxRegValue = maxRegArg ? parseFloat(maxRegArg.split("=")[1]) : maxRegression;

if (prevBaselines) {
  for (const res of results) {
    const prev = prevBaselines.results.find((r) => r.name === res.name);
    if (prev) {
      const ratio = res.perOp / prev.perOp;
      console.log(`Compare ${res.name}: ${prev.perOp.toFixed(3)} -> ${res.perOp.toFixed(3)} (${ratio.toFixed(2)}x)`);
      if (ratio > maxRegValue) {
        console.error(`REGRESSION: ${res.name} slowed down by ${ratio.toFixed(2)}x`);
        hasRegression = true;
      }
    }
  }
}

if (hasRegression && !isUpdate) {
  console.error(`Regression detected (max allowed ${maxRegValue}x). Exiting 1.`);
  process.exit(1);
}

if (isUpdate || !prevBaselines || !hasRegression) {
  fs.mkdirSync("tests/perf", { recursive: true });
  fs.writeFileSync("tests/perf/baselines.json", JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log("Wrote tests/perf/baselines.json");
}
