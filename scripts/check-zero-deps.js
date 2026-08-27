#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const deps = Object.keys(pkg.dependencies ?? {});
if (deps.length > 0) {
  console.error(`FAIL: runtime dependencies found: ${deps.join(", ")}`);
  process.exit(1);
}
console.log("PASS: zero runtime dependencies");
if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) {
  const lock = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
  // ensure no runtime deps in lock importers
}
