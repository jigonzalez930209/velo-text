#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { validateDocument } from "../dist/core/schema/validator.js";
import { canonicalStringify, contentHashHex } from "../dist/core/schema/canonical.js";
import { normalizeDocument, isIdempotent } from "../dist/core/normalize/normalize.js";

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
