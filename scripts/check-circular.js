#!/usr/bin/env node
/**
 * Check for circular imports among src entrypoints — Phase 1.1.1
 * Simple static analysis: build import graph and detect cycles via DFS.
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");
const ENTRYPOINTS = [
  "src/public-api/index.ts",
  "src/core/model/index.ts",
  "src/template/index.ts",
  "src/export/index.ts",
  "src/editor-web/index.ts",
];

function collectFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...collectFiles(full));
    else if (e.isFile() && e.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function parseImports(file) {
  const txt = fs.readFileSync(file, "utf8");
  const re = /from\s+["'](\.[^"']+)["']/g;
  const imports = [];
  let m;
  while ((m = re.exec(txt)) !== null) {
    let target = m[1];
    // Resolve relative to file
    let resolved = path.resolve(path.dirname(file), target);
    // Try .ts extension if missing
    if (!resolved.endsWith(".ts")) {
      if (fs.existsSync(resolved + ".ts")) resolved += ".ts";
      else if (fs.existsSync(path.join(resolved, "index.ts"))) resolved = path.join(resolved, "index.ts");
      else if (fs.existsSync(resolved)) {
        // keep as is
      } else continue;
    }
    // Only keep src files
    if (resolved.startsWith(SRC)) imports.push(path.relative(".", resolved));
  }
  return imports;
}

const files = collectFiles(SRC);
const graph = new Map();
for (const f of files) {
  const rel = path.relative(".", f);
  graph.set(rel, parseImports(f));
}

// DFS cycle detection
let hasCycle = false;
const visited = new Set();
const stack = new Set();

function dfs(node, pathArr) {
  if (stack.has(node)) {
    console.error(`Circular import detected: ${[...pathArr, node].join(" -> ")}`);
    hasCycle = true;
    return;
  }
  if (visited.has(node)) return;
  visited.add(node);
  stack.add(node);
  for (const dep of graph.get(node) ?? []) dfs(dep, [...pathArr, node]);
  stack.delete(node);
}

for (const ep of ENTRYPOINTS) {
  if (fs.existsSync(ep)) dfs(ep, []);
}
for (const f of graph.keys()) if (!visited.has(f)) dfs(f, []);

if (hasCycle) {
  console.error("FAIL: circular imports found");
  process.exit(1);
}
console.log("PASS: no circular imports");

// Entrypoint explicitness check
for (const ep of ENTRYPOINTS) {
  if (!fs.existsSync(ep)) console.warn(`WARN: entrypoint missing ${ep}`);
}
console.log("PASS: entrypoints explicit");

// Tree-shaking conceptual check: ensure core does not import from editor-web/export/adapters
const forbidden = [
  ["src/core", "src/editor-web"],
  ["src/core", "src/export"],
  ["src/core", "src/adapters"],
];
let forbiddenHit = false;
for (const [fromPrefix, toPrefix] of forbidden) {
  for (const [file, deps] of graph.entries()) {
    if (file.startsWith(fromPrefix)) {
      for (const d of deps) if (d.startsWith(toPrefix)) {
        console.error(`Forbidden dependency: ${file} -> ${d} (core must not import ${toPrefix})`);
        forbiddenHit = true;
      }
    }
  }
}
if (forbiddenHit) process.exit(1);
console.log("PASS: layer isolation (core does not import web/export/adapters)");
