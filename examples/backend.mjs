#!/usr/bin/env node
// Ejemplo backend — export determinista, sin DOM
import fs from "node:fs";
import { createDocument, createIdGenerator } from "../dist/public-api/index.js";
import { exportDocument } from "../dist/export/index.js";
import { createBufferSink } from "../dist/adapters/backend/index.js";

const idGen = createIdGenerator("be");
const clock = { nowIso: () => "2026-08-27T12:00:00.000Z" };
const doc = createDocument({ idGenerator: idGen, clock });
doc.metadata.title = "Factura";
doc.root.children.push(
  { type: "heading", id: idGen.next(), level: 1, children: [{ type: "text", id: idGen.next(), text: "Factura" }] },
  { type: "paragraph", id: idGen.next(), children: [{ type: "text", id: idGen.next(), text: "Cliente: " }, { type: "variable", id: idGen.next(), path: "customer.name", source: "{{customer.name}}", valueType: "string" }] },
  {
    type: "table", id: idGen.next(), columns: [{ id: idGen.next(), widthUm: 60000 }, { id: idGen.next(), widthUm: 40000 }],
    rows: [
      { id: idGen.next(), cells: [{ id: idGen.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: idGen.next(), children: [{ type: "text", id: idGen.next(), text: "Concepto" }] }] }, { id: idGen.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: idGen.next(), children: [{ type: "text", id: idGen.next(), text: "Precio" }] }] }] },
      { id: "tmpl_row", cells: [{ id: idGen.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: idGen.next(), children: [{ type: "variable", id: idGen.next(), path: "item.name", source: "{{item.name}}", valueType: "string" }] }] }, { id: idGen.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: idGen.next(), children: [{ type: "variable", id: idGen.next(), path: "item.price", source: "{{item.price | currency:ARS}}", valueType: "number", format: "currency:ARS" }] }] }] },
    ],
    repeat: { path: "items", alias: "item", templateRowId: "tmpl_row" },
  },
);

const data = {
  customer: { name: "Empresa S.A." },
  items: [
    { name: "Servicio A", price: 10000 },
    { name: "Servicio B", price: 25000.5 },
  ],
};

for (const fmt of ["pdf", "odt", "docx"]) {
  const { sink, getBuffer } = createBufferSink();
  await exportDocument({ document: doc, data, format: fmt, sink, options: { deterministic: true, strict: false }, clock });
  const buf = getBuffer();
  fs.writeFileSync(`./demo-backend.${fmt}`, buf);
  console.log(`wrote demo-backend.${fmt} ${buf.length} bytes`);
}
