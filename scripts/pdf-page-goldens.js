#!/usr/bin/env node
/**
 * CI tool: rasterize PDF pages with system pdftoppm (poppler-utils), not an npm dep.
 * Compare against tests/visual/pdf-pages/*.png. UPDATE_PDF_GOLDENS=1 rewrites goldens.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createDocument, createIdGenerator, createParagraph, createText } from "../dist/core/model/factories.js";
import { exportPdf } from "../dist/export/pdf/export-pdf.js";
import { decodePngImage, ensureInflateLoaded } from "../dist/export/pdf/image.js";

const GOLDEN_DIR = "tests/visual/pdf-pages";
const DPI = 36;
const MAX_MAE = 4;

function which(bin) {
  const r = spawnSync("which", [bin], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

function sampleDoc() {
  const g = createIdGenerator("pdfvis");
  const clock = { nowIso: () => "2026-08-28T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: g, clock });
  doc.root.children.push(createParagraph(g, [
    createText(g, "Black 11pt "),
    createText(g, "blue 18pt", { color: "#3659e3", fontSizePt: 18 }),
    createText(g, " "),
    createText(g, "bold", { bold: true }),
    createText(g, " "),
    createText(g, "red", { color: "#b42318" }),
  ]));
  return { doc, clock };
}

function rasterPdf(pdfBytes, workDir) {
  const pdfPath = path.join(workDir, "page.pdf");
  fs.writeFileSync(pdfPath, pdfBytes);
  const prefix = path.join(workDir, "page");
  const r = spawnSync("pdftoppm", ["-png", "-r", String(DPI), "-f", "1", "-l", "1", pdfPath, prefix], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "pdftoppm failed");
  const pngPath = fs.existsSync(`${prefix}-1.png`) ? `${prefix}-1.png` : `${prefix}.png`;
  if (!fs.existsSync(pngPath)) throw new Error(`pdftoppm wrote no PNG under ${prefix}`);
  return fs.readFileSync(pngPath);
}

function mae(a, b) {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) sum += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return sum / n;
}

async function main() {
  const pdftoppm = which("pdftoppm");
  if (!pdftoppm) {
    const msg = "pdftoppm not found (install poppler-utils). PDF page goldens skipped.";
    if (process.env.CI) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(msg);
    return;
  }
  await ensureInflateLoaded();
  const { doc, clock } = sampleDoc();
  const { bytes } = await exportPdf({ document: doc, data: {}, options: { strict: false }, clock });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "velo-pdf-"));
  try {
    const png = rasterPdf(bytes, work);
    fs.mkdirSync(GOLDEN_DIR, { recursive: true });
    const goldenPath = path.join(GOLDEN_DIR, "marks-page1.png");
    if (process.env.UPDATE_PDF_GOLDENS === "1") {
      fs.writeFileSync(goldenPath, png);
      console.log(`wrote ${goldenPath} (${png.length} bytes)`);
      return;
    }
    if (!fs.existsSync(goldenPath)) {
      throw new Error(`missing ${goldenPath}; run UPDATE_PDF_GOLDENS=1 pnpm run test:pdf-pages`);
    }
    const got = await decodePngImage(png);
    const exp = await decodePngImage(fs.readFileSync(goldenPath));
    if (!got?.rgb || !exp?.rgb) throw new Error("PNG decode failed");
    if (got.widthPx !== exp.widthPx || got.heightPx !== exp.heightPx) {
      throw new Error(`size ${got.widthPx}x${got.heightPx} != golden ${exp.widthPx}x${exp.heightPx}`);
    }
    const err = mae(got.rgb, exp.rgb);
    if (err > MAX_MAE) {
      throw new Error(`PDF page MAE ${err.toFixed(3)} > ${MAX_MAE}`);
    }
    console.log(`pdf page golden ok MAE=${err.toFixed(3)} ${got.widthPx}x${got.heightPx}`);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
