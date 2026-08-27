#!/usr/bin/env node
// Lint interno mínimo: no console sin prefijo, require de window/document/fs en core
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const forbiddenInCore = ["window.", "document.", "require(\"fs\"", "from \"fs\"", "process.env"];
const coreDir = path.join(root, "src/core");
let errors = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes:true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.isFile() && e.name.endsWith(".js")) {
      const txt = fs.readFileSync(full, "utf8");
      for (const pat of forbiddenInCore) if (txt.includes(pat)) {
        console.error(`lint: forbidden "${pat}" in ${path.relative(root, full)}`);
        errors++;
      }
    }
  }
}
if (fs.existsSync(coreDir)) walk(coreDir);
if (errors) process.exit(1);
console.log("lint: ok (core isolation)");
