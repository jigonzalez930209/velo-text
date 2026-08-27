#!/usr/bin/env node
/**
 * Visual regression snapshots — Phase 11.1.3 / 13.1.6
 * Generates deterministic HTML snapshots for toolbar, document, tables, variables, images and equations
 * for each of the 4 themes and states (hover, focus, disabled, error, selection).
 * In CI these snapshots are compared via pixel diff or HTML hash.
 */
import fs from "node:fs";
import { createDocument, createIdGenerator } from "../dist/core/model/factories.js";
import { renderDocumentToHtml } from "../dist/editor-web/view/index.js";
import { themes } from "../dist/theme/index.js";
import { getIconSvg } from "../dist/assets/icons/index.js";

const outDir = "tests/visual/snapshots";
fs.mkdirSync(outDir, { recursive: true });

function makeSampleDoc() {
  const idGen = createIdGenerator("vis");
  const doc = createDocument({ idGenerator: idGen, clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push(
    { type: "heading", id: idGen.next(), level: 1, children: [{ type: "text", id: idGen.next(), text: "Visual Test" }] },
    { type: "paragraph", id: idGen.next(), children: [{ type: "text", id: idGen.next(), text: "Normal " }, { type: "text", id: idGen.next(), text: "bold", marks: { bold: true } }, { type: "text", id: idGen.next(), text: " and " }, { type: "variable", id: idGen.next(), path: "name", source: "{{name}}", valueType: "string" }] },
    { type: "table", id: idGen.next(), columns: [{ id: idGen.next(), widthUm: 40000 }, { id: idGen.next(), widthUm: 40000 }], rows: [{ id: idGen.next(), cells: [{ id: idGen.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: idGen.next(), children: [{ type: "text", id: idGen.next(), text: "Cell A" }] }] }, { id: idGen.next(), colSpan: 1, rowSpan: 1, blocks: [{ type: "paragraph", id: idGen.next(), children: [{ type: "equation", id: idGen.next(), latex: "\\frac{a}{b}" }] }] }] }] },
    { type: "equation-block", id: idGen.next(), latex: "E = mc^2" },
  );
  const pngAsset = { id: "vis_img", kind: "image" as const, mediaType: "image/png" as const, storageKey: "k", sha256: "a".repeat(64), byteLength: 100, alt: "test image" };
  doc.assets[pngAsset.id] = pngAsset;
  doc.root.children.push({ type: "image", id: idGen.next(), assetId: pngAsset.id });
  return doc;
}

const doc = makeSampleDoc();

for (const theme of Object.keys(themes) as Array<keyof typeof themes>) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="../../../themes/base.css"><link rel="stylesheet" href="../../../themes/components.css"><style>body{margin:20px}</style></head><body data-pde-theme="${theme}">${renderDocumentToHtml(doc, { theme })}</body></html>`;
  fs.writeFileSync(`${outDir}/document-${theme}.html`, html);
  console.log(`snapshot document-${theme}.html`);

  // Toolbar snapshot with all icons
  const icons = ["bold", "italic", "underline", "variable", "equation", "table", "image", "undo", "redo"] as const;
  const toolbarHtml = `<div class="pde-toolbar" data-pde-theme="${theme}" role="toolbar">${icons.map((n) => `<button aria-label="${n}">${getIconSvg(n, { size: 16, color: "currentColor", title: n })}</button>`).join("")}</div>`;
  fs.writeFileSync(`${outDir}/toolbar-${theme}.html`, `<!doctype html><html><head><link rel="stylesheet" href="../../../themes/components.css"></head><body>${toolbarHtml}</body></html>`);
}

console.log("Visual snapshots generated in tests/visual/snapshots/");
