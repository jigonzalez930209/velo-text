#!/usr/bin/env node
/**
 * Fail if overall or any top-level lib part is under 90% line coverage.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const summaryPath = path.join(root, "coverage", "coverage-summary.json");
if (!fs.existsSync(summaryPath)) {
  console.error("missing coverage/coverage-summary.json — run pnpm coverage first");
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const THRESHOLD = 90;

function rel(key) {
  return key.replace(/^.*[/\\](src|dist)[/\\]/, "").replace(/\\/g, "/");
}

const parts = {};
for (const [key, metrics] of Object.entries(summary)) {
  if (key === "total") continue;
  const r = rel(key);
  const part = r.split("/")[0];
  if (!parts[part]) parts[part] = { covered: 0, total: 0 };
  parts[part].covered += metrics.lines.covered;
  parts[part].total += metrics.lines.total;
}

let failed = 0;
const tot = summary.total.lines;
const totPct = tot.pct;
console.log(`overall lines ${totPct}% (${tot.covered}/${tot.total})`);
if (totPct < THRESHOLD) {
  console.error(`FAIL overall lines ${totPct}% < ${THRESHOLD}%`);
  failed++;
}

for (const name of Object.keys(parts).sort()) {
  const p = parts[name];
  const pct = p.total ? Math.round((p.covered / p.total) * 10000) / 100 : 100;
  const tag = pct >= THRESHOLD ? "ok" : "FAIL";
  console.log(`${tag} ${name} ${pct}% (${p.covered}/${p.total})`);
  if (pct < THRESHOLD) failed++;
}

process.exit(failed ? 1 : 0);
