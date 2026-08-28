#!/usr/bin/env node
/**
 * Short soak: repeated export of pdf/odt/docx (no extra deps).
 * SOAK_ITERS default 20; CI uses a smaller value.
 */
import { createDocument, createIdGenerator } from "../dist/core/model/factories.js";
import { exportDocument } from "../dist/export/index.js";
import { validatePdf, validateOdt, validateDocx } from "../dist/export/validate.js";

const iters = Number(process.env.SOAK_ITERS ?? 20);
const validators = { pdf: validatePdf, odt: validateOdt, docx: validateDocx };

async function once(i) {
  const g = createIdGenerator(`soak${i}`);
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
  doc.root.children.push({
    type: "paragraph",
    id: g.next(),
    children: [{ type: "text", id: g.next(), text: `soak ${i}` }],
  });
  for (const format of ["pdf", "odt", "docx"]) {
    const chunks = [];
    await exportDocument({
      document: doc,
      data: {},
      format,
      sink: { write: (c) => { chunks.push(c); }, close: () => {} },
      options: { strict: false, deterministic: true },
    });
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const bytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { bytes.set(c, off); off += c.length; }
    const errors = validators[format](bytes).filter((x) => x.severity === "error");
    if (errors.length) throw new Error(`${format} #${i}: ${errors.map((e) => e.message).join("; ")}`);
  }
}

for (let i = 0; i < iters; i++) await once(i);
console.log(`soak: ok ${iters} × pdf/odt/docx`);
