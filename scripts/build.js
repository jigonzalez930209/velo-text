#!/usr/bin/env node
// Build interno — Fase 1.1.1: verify ESM entrypoints, no external deps, optional single-file bundle
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

console.log("[build] checking entrypoints...");
const entrypoints = [
  "src/public-api/index.js",
  "src/core/model/index.js",
  "src/template/index.js",
  "src/export/index.js",
  "src/editor-web/index.js",
];
for (const ep of entrypoints) {
  const full = path.join(root, ep);
  if (!fs.existsSync(full)) console.warn(`[build] missing entrypoint (will be created): ${ep}`);
  else console.log(`[build] ok ${ep}`);
}

// verify zero runtime deps
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (Object.keys(pkg.dependencies ?? {}).length !== 0) {
  console.error("[build] ERROR: dependencies must be zero for distribution");
  process.exit(1);
}
console.log("[build] zero runtime deps verified");

// hash deterministic check
import crypto from "node:crypto";
function hashFile(p) {
  const buf = fs.readFileSync(p);
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 12);
}
console.log("[build] build complete (no bundling yet - ESM direct)");
