#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { createDocument, createIdGenerator, createTable } from "../dist/core/model/factories.js";
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

  const table = createTable(idGen, 2, 2);
  table.rows[0].cells[0].blocks[0].children[0].text = "Cell A";
  table.rows[0].cells[1].blocks[0].children[0].text = "Cell B";
  table.rows[1].cells[0].blocks[0].children[0].text = "Cell C";
  table.rows[1].cells[1].blocks[0].children[0].text = "Cell D";
  doc.root.children.push(table);

  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "velo-lo-"));

  for (const fmt of ["odt", "docx"]) {
    const filePath = path.join(tmpdir, `test.${fmt}`);
    const chunks = [];
    const sink = {
      write: (c) => { chunks.push(c); },
      close: () => {},
    };

    await exportDocument({
      document: doc,
      data: { var: "value" },
      format: fmt,
      sink,
      assets: {},
      options: { deterministic: false, strict: false },
    });

    const total = chunks.reduce((n, c) => n + c.length, 0);
    const all = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }
    fs.writeFileSync(filePath, all);

    execSync(`libreoffice --headless --convert-to pdf --outdir "${tmpdir}" "${filePath}"`, { stdio: "ignore" });

    const pdfPath = path.join(tmpdir, "test.pdf");
    if (!fs.existsSync(pdfPath)) {
      console.error(`FAIL: LibreOffice did not produce test.pdf for ${fmt}`);
      process.exit(1);
    }
    const buf = fs.readFileSync(pdfPath);
    if (buf.length < 4 || buf[0] !== 0x25 || buf[1] !== 0x50 || buf[2] !== 0x44 || buf[3] !== 0x46) {
      console.error(`FAIL: ${fmt} to PDF did not produce valid magic bytes`);
      process.exit(1);
    }
    console.log(`${fmt} to PDF check: PASS (${buf.length} bytes)`);

    fs.unlinkSync(pdfPath);
    fs.unlinkSync(filePath);
  }

  fs.rmSync(tmpdir, { recursive: true, force: true });
  console.log("check-libreoffice: PASS");
}

main().catch((e) => { console.error(e); process.exit(1); });
