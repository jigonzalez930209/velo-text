#!/usr/bin/env node
/**
 * Validate all fixtures against validator, canonical hash and idempotence — Phase 2 & 13
 * Deterministic with fixed clock/ids.
 */
import fs from "node:fs";
import path from "node:path";
import { validateDocument } from "../src/core/schema/validator.ts";
import { canonicalStringify, contentHashHex } from "../src/core/schema/canonical.ts";
import { normalizeDocument, isIdempotent } from "../src/core/normalize/normalize.ts";

const dir = "tests/fixtures";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
let ok = 0, fail = 0;
for (const f of files) {
  const doc = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const v = validateDocument(doc, { strict: true });
  if (!v.valid) {
    console.error(`FAIL ${f}:`, v.errors.slice(0, 2).map((e) => `${e.path} ${e.code}`).join(", "));
    fail++;
    continue;
  }
  const norm = normalizeDocument(doc);
  if (!isIdempotent(norm)) {
    console.error(`FAIL ${f}: not idempotent`);
    fail++;
    continue;
  }
  const hash = contentHashHex(doc);
  const canon = canonicalStringify(doc);
  // Determinism check: second hash must match
  const hash2 = contentHashHex(JSON.parse(canon));
  if (hash !== hash2) {
    console.error(`FAIL ${f}: hash not deterministic`);
    fail++;
    continue;
  }
  ok++;
}
console.log(`fixtures: ${ok} ok, ${fail} fail of ${files.length}`);
if (fail > 0) process.exit(1);
