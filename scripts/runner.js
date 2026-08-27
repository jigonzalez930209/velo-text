#!/usr/bin/env node
/**
 * Runner interno — Fase 1.1.2
 * API: test(name, fn), describe, assert, TAP/JSON output
 * Cero dependencias externas. Soporte async, timeout y seeds.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let suites = [];
let currentSuite = null;
let total = 0, passed = 0, failed = 0;
let seed = Date.now();

function test(name, fn, opts = {}) {
  const suite = currentSuite ?? "default";
  suites.push({ suite, name, fn, opts, timeout: opts.timeout ?? 5000 });
}

function describe(name, fn) {
  const prev = currentSuite;
  currentSuite = name;
  fn();
  currentSuite = prev;
}

function assert(cond, msg = "assertion failed") {
  if (!cond) throw new Error(msg);
}
assert.equal = (a, b, msg) => { if (a !== b) throw new Error(msg ?? `expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`); };
assert.deepEqual = (a, b, msg) => {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error(msg ?? `deepEqual failed: ${ja} !== ${jb}`);
};
assert.throws = (fn, msg) => { let threw = false; try { fn(); } catch { threw = true; } if (!threw) throw new Error(msg ?? "expected to throw"); };
assert.match = (str, re, msg) => { if (!re.test(str)) throw new Error(msg ?? `expected ${str} to match ${re}`); };

globalThis.test = test;
globalThis.describe = describe;
globalThis.assert = assert;

async function runOne(t) {
  total++;
  const start = performance.now();
  let timeoutId;
  try {
    const p = Promise.resolve().then(() => t.fn());
    const timeout = new Promise((_, rej) => {
      timeoutId = setTimeout(() => rej(new Error(`timeout ${t.timeout}ms`)), t.timeout);
    });
    await Promise.race([p, timeout]);
    passed++;
    const dur = (performance.now() - start).toFixed(1);
    console.log(`ok ${total} - ${t.suite} :: ${t.name} # time=${dur}ms`);
    return true;
  } catch (e) {
    failed++;
    console.log(`not ok ${total} - ${t.suite} :: ${t.name}`);
    console.log(`  ---`);
    console.log(`  message: ${e.message}`);
    if (e.stack) console.log(`  stack: ${e.stack.split("\n").slice(1,3).join(" | ")}`);
    console.log(`  ...`);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function discover(dir, pattern) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await discover(full, pattern));
    else if (entry.isFile() && pattern.test(entry.name)) files.push(full);
  }
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const suiteFilter = args.find(a => a.startsWith("--suite="))?.split("=")[1];
  const seedArg = args.find(a => a.startsWith("--seed="))?.split("=")[1];
  if (seedArg) seed = Number(seedArg);
  console.log(`TAP version 13`);
  console.log(`# seed=${seed}`);

  const testDirs = suiteFilter ? [path.join(root, "tests", suiteFilter)] : [path.join(root, "tests")];
  const files = (await Promise.all(testDirs.map(d => discover(d, /\.test\.(js|mjs)$/)))).flat().sort();
  if (suiteFilter && files.length === 0) {
    // fallback: allow tests/**/*.test.js
    const all = await discover(path.join(root, "tests"), /\.test\.(js|mjs)$/);
    files.push(...all.filter(f => f.includes(suiteFilter)));
  }
  for (const f of files) {
    console.log(`# loading ${path.relative(root, f)}`);
    await import(f);
  }
  // Deterministic shuffle by seed if needed
  // simple LCG shuffle
  let s = seed;
  function rand() { s = (s * 1664525 + 1013904223) % 0x100000000; return s / 0x100000000; }
  // keep order stable by default, shuffle only if --shuffle
  if (args.includes("--shuffle")) {
    for (let i = suites.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [suites[i], suites[j]] = [suites[j], suites[i]];
    }
  }

  console.log(`1..${suites.length}`);
  for (const t of suites) await runOne(t);

  console.log(`# tests ${total}`);
  console.log(`# pass ${passed}`);
  console.log(`# fail ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
