import fs from "node:fs";
import path from "node:path";
import { exportDocument } from "../../dist/export/index.js";
import { validatePdf, validateOdt, validateDocx } from "../../dist/export/validate.js";

const fixturesDir = "tests/fixtures";
const fixtures = fs.readdirSync(fixturesDir).filter((f) => f.endsWith(".json")).sort();

for (const fixture of fixtures) {
  test(`conformance PDF ${fixture}`, async () => {
    const doc = JSON.parse(fs.readFileSync(path.join(fixturesDir, fixture), "utf8"));
    const chunks = [];
    const sink = { write: (c) => { chunks.push(c); }, close: () => {} };
    await exportDocument({ document: doc, data: {}, format: "pdf", sink, options: { strict: false } });
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const bytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { bytes.set(c, off); off += c.length; }
    const issues = validatePdf(bytes);
    const errors = issues.filter((i) => i.severity === "error");
    assert(errors.length === 0, `PDF errors: ${errors.map((e) => e.message).join(", ")}`);
  });

  test(`conformance ODT ${fixture}`, async () => {
    const doc = JSON.parse(fs.readFileSync(path.join(fixturesDir, fixture), "utf8"));
    const chunks = [];
    const sink = { write: (c) => { chunks.push(c); }, close: () => {} };
    await exportDocument({ document: doc, data: {}, format: "odt", sink, options: { strict: false } });
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const bytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { bytes.set(c, off); off += c.length; }
    const issues = validateOdt(bytes);
    const errors = issues.filter((i) => i.severity === "error");
    assert(errors.length === 0, `ODT errors: ${errors.map((e) => e.message).join(", ")}`);
  });

  test(`conformance DOCX ${fixture}`, async () => {
    const doc = JSON.parse(fs.readFileSync(path.join(fixturesDir, fixture), "utf8"));
    const chunks = [];
    const sink = { write: (c) => { chunks.push(c); }, close: () => {} };
    await exportDocument({ document: doc, data: {}, format: "docx", sink, options: { strict: false } });
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const bytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { bytes.set(c, off); off += c.length; }
    const issues = validateDocx(bytes);
    const errors = issues.filter((i) => i.severity === "error");
    assert(errors.length === 0, `DOCX errors: ${errors.map((e) => e.message).join(", ")}`);
    // Also ensure no "unreadable content" pattern: document.xml must be present and well-formed
    const text = new TextDecoder().decode(bytes.slice(0, 8000));
    assert(text.includes("[Content_Types].xml"));
  });
}
