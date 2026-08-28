/**
 * Image export: PNG encode/decode, area downscale, aligned PDF placement.
 */
import { encodePngRgb } from "../../dist/export/images/png-encode.js";
import { downsampleRgb, maxImageDisplayUm } from "../../dist/export/images/downsample.js";
import { prepareExportImages, targetEmbedPx } from "../../dist/export/images/prepare.js";
import { decodePngImage, getInflate, decodeImageForPdf } from "../../dist/export/pdf/image.js";
import { buildPdfPages } from "../../dist/export/pdf/layout-pages.js";
import { pageContentStream } from "../../dist/export/pdf/stream.js";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";
import { pxToUm } from "../../dist/export/layout/units.js";

test("png: encode RGB then decode round-trips", async () => {
  const rgb = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 10, 20, 30]);
  const bytes = encodePngRgb(rgb, 2, 2);
  const infl = await getInflate();
  const img = await decodePngImage(bytes, infl);
  assert(img && img.widthPx === 2 && img.heightPx === 2);
  assert(img.rgb[0] === 255 && img.rgb[1] === 0 && img.rgb[2] === 0);
  assert(img.rgb[9] === 10 && img.rgb[11] === 30);
});

test("downsample: 2x2 area average to 1x1", () => {
  const src = new Uint8Array([
    0, 0, 0, 100, 0, 0,
    0, 100, 0, 0, 0, 100,
  ]);
  const out = downsampleRgb(src, 2, 2, 1, 1);
  assert(out.length === 3);
  assert(out[0] === 25 && out[1] === 25 && out[2] === 25);
});

test("prepare: keeps source PNG pixels", async () => {
  const rgb = new Uint8Array(4 * 4 * 3);
  rgb.fill(200);
  const png = encodePngRgb(rgb, 4, 4);
  const g = createIdGenerator("im");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  const wUm = pxToUm(2);
  const hUm = pxToUm(2);
  doc.root.children.push({ type: "image", id: g.next(), assetId: "big", widthUm: wUm, heightUm: hUm });
  const prepared = await prepareExportImages(doc, { big: { id: "big", mediaType: "image/png", data: png } });
  assert(prepared.big.decoded && prepared.big.decoded.widthPx === 4 && prepared.big.decoded.heightPx === 4);
  assert(prepared.big.data === png || prepared.big.data.length === png.length);
});

test("targetEmbedPx does not upscale", () => {
  const t = targetEmbedPx(10, 10, pxToUm(50), pxToUm(50));
  assert(t.w === 10 && t.h === 10);
});

test("maxImageDisplayUm walks nested columns", () => {
  const found = maxImageDisplayUm(
    [{ type: "columns", columns: [{ blocks: [{ type: "image", assetId: "a", widthUm: 1000, heightUm: 500 }] }] }],
    "a",
  );
  assert(found && found.widthUm === 1000 && found.heightUm === 500);
});

test("decode: empty mediaType still reads PNG bytes", async () => {
  const rgb = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 10, 20, 30]);
  const png = encodePngRgb(rgb, 2, 2);
  const img = await decodeImageForPdf(png, "");
  assert(img && img.widthPx === 2 && img.rgb);
});

test("pdf: centered image uses mid-page x", () => {
  const g = createIdGenerator("im");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => "2026-08-27T12:00:00.000Z" } });
  doc.root.children.push({
    type: "image", id: g.next(), assetId: "a1", widthUm: 50000, heightUm: 30000, align: "center",
  });
  const pages = buildPdfPages(doc);
  const { stream } = pageContentStream(pages[0], doc, new Map([["a1", 10]]));
  const m = stream.match(/q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/);
  assert(m, "image cm op");
  const x = Number(m[3]);
  assert(x > 57 && x < 300, `centered x should be inset, got ${x}`);
});
