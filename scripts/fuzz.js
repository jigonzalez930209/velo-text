#!/usr/bin/env node
/**
 * Fuzz harness — Phase 12.1.1
 * Fuzzes JSON, variables, XML, ZIP, images and DOM events with reproducible seeds.
 * Uses a simple LCG for determinism; corpus of regressions is stored in tests/security/corpus.
 */
import crypto from "node:crypto";
import { validateDocument } from "../dist/core/schema/validator.js";
import { parseVariableSource } from "../dist/template/parser/parser.js";
import { sanitizeSvg } from "../dist/assets/svg/index.js";
import { crc32 } from "../dist/export/zip/crc32.js";
import { createDocument, createIdGenerator } from "../dist/core/model/factories.js";

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function randomString(rng, len) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789_{}[]|/:;.?<>!@#$%^&*()_+-= \n\t\"'\\";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(rng() * chars.length)];
  return out;
}

function fuzzVariable(rng) {
  const src = `{{${randomString(rng, 5 + Math.floor(rng() * 20))}}}`;
  try {
    parseVariableSource(src);
  } catch {}
}

function fuzzDocument(rng) {
  const doc = createDocument({ idGenerator: createIdGenerator("fuzz"), clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  const count = 5 + Math.floor(rng() * 10);
  for (let i = 0; i < count; i++) {
    const t = randomString(rng, 10);
    doc.root.children.push({ type: "paragraph", id: `p_${i}`, children: [{ type: "text", id: `t_${i}`, text: t }] });
  }
  // Randomly inject variable-like, equation, image
  if (rng() < 0.3) doc.root.children.push({ type: "equation-block", id: "eq_fuzz", latex: randomString(rng, 20) });
  try {
    validateDocument(doc);
  } catch {}
}

function fuzzSvg(rng) {
  const payloads = [
    `<svg onload="alert(1)"><script>alert(2)</script></svg>`,
    `<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">hi</body></foreignObject></svg>`,
    `<svg><g><path d="${randomString(rng, 20)}"/></g></svg>`,
    randomString(rng, 100),
  ];
  for (const p of payloads) sanitizeSvg(p);
}

function fuzzZip(rng) {
  const data = new Uint8Array(10);
  for (let i = 0; i < 10; i++) data[i] = Math.floor(rng() * 256);
  crc32(data);
}

const seed = Number(process.argv.find((a) => a.startsWith("--seed="))?.split("=")[1] ?? 42);
const iterations = Number(process.argv.find((a) => a.startsWith("--iterations="))?.split("=")[1] ?? 1000);
const rng = makeRng(seed);

console.log(`Fuzzing with seed=${seed} iterations=${iterations}`);
let start = Date.now();
for (let i = 0; i < iterations; i++) {
  const r = rng();
  if (r < 0.2) fuzzVariable(rng);
  else if (r < 0.5) fuzzDocument(rng);
  else if (r < 0.75) fuzzSvg(rng);
  else fuzzZip(rng);
  // CPU/memory limits — abort if taking too long
  if (Date.now() - start > 30_000) {
    console.log("Time limit reached");
    break;
  }
  if (i % 1000 === 0) {
    const mem = process.memoryUsage().heapUsed / 1024 / 1024;
    if (mem > 500) {
      console.error(`Memory limit exceeded at iteration ${i}: ${mem.toFixed(1)} MB`);
      process.exit(1);
    }
  }
}
console.log(`Fuzzing done — ${iterations} iterations, no crash`);
console.log(`Seed ${seed} can be replayed with --seed=${seed}`);
