#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { createDocument, createIdGenerator } from "../dist/core/model/factories.js";
import { exportDocument } from "../dist/export/index.js";

async function main() {
  try {
    execSync("libreoffice --version", { stdio: "ignore" });
  } catch (e) {
    console.warn("libreoffice not found, skipping check.");
    process.exit(0);
  }

  const clock = { nowIso: () => new Date().toISOString() };
  const idGen = createIdGenerator("lo");
  const doc = createDocument({ idGenerator: idGen, clock });

  doc.root.children.push({
    type: "paragraph",
    id: idGen.next(),
    children: [
      { type: "text", id: idGen.next(), text: "LibreOffice check " },
      { type: "variable", id: idGen.next(), path: "var", source: "{{var}}", valueType: "string" },
      { type: "text", id: idGen.next(), text: " " },
      { type: "equation", id: idGen.next(), latex: "E=mc^2" },
    ],
  });

  doc.root.children.push({
    type: "table",
    id: idGen.next(),
    rows: 2,
    cols: 2,
    children: [
      { type: "table-cell", id: idGen.next(), row: 0, col: 0, rowspan: 1, colspan: 1, children: [{ type: "paragraph", id: idGen.next(), children: [{ type: "text", id: idGen.next(), text: "A" }] }] },
      { type: "table-cell", id: idGen.next(), row: 0, col: 1, rowspan: 1, colspan: 1, children: [{ type: "paragraph", id: idGen.next(), children: [{ type: "text", id: idGen.next(), text: "B" }] }] },
      { type: "table-cell", id: idGen.next(), row: 1, col: 0, rowspan: 1, colspan: 1, children: [{ type: "paragraph", id: idGen.next(), children: [{ type: "text", id: idGen.next(), text: "C" }] }] },
      { type: "table-cell", id: idGen.next(), row: 1, col: 1, rowspan: 1, colspan: 1, children: [{ type: "paragraph", id: idGen.next(), children: [{ type: "text", id: idGen.next(), text: "D" }] }] },
    ]
  });

  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "velo-lo-"));

  for (const fmt of ["odt", "docx"]) {
    const filePath = path.join(tmpdir, `test.${fmt}`);
    const stream = fs.createWriteStream(filePath);
    await exportDocument({
      document: doc,
      data: { var: "value" },
      format: fmt,
      sink: {
        write: (c) => stream.write(c),
        close: () => stream.end()
      },
      assets: {},
      options: { deterministic: false, strict: false },
    });

    await new Promise((resolve) => stream.on("finish", resolve));

    execSync(`libreoffice --headless --convert-to pdf test.${fmt}`, { cwd: tmpdir });

    const pdfPath = path.join(tmpdir, "test.pdf");
    const buf = fs.readFileSync(pdfPath);
    if (buf.length < 4 || buf[0] !== 0x25 || buf[1] !== 0x50 || buf[2] !== 0x44 || buf[3] !== 0x46) {
      console.error(`FAIL: ${fmt} to PDF did not produce valid magic bytes`);
      process.exit(1);
    }
    console.log(`${fmt} to PDF check: PASS`);
    
    fs.unlinkSync(pdfPath);
  }

  fs.rmSync(tmpdir, { recursive: true, force: true });
}

main().catch((e) => { console.error(e); process.exit(1); });
