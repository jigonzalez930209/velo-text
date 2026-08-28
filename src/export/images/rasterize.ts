import type { DecodedImage } from "../pdf/image.js";
import { sniffImage } from "../../assets/sniff/index.js";

function sniffType(data: Uint8Array): string {
  return sniffImage(data).mediaType ?? "application/octet-stream";
}

/**
 * Last-resort decode in browsers (and Node with ImageBitmap): WebP, indexed PNG,
 * SVG, and files with an empty/wrong MIME still become DeviceRGB for PDF.
 */
export async function decodeViaBitmap(data: Uint8Array): Promise<DecodedImage | null> {
  const g = globalThis as {
    createImageBitmap?: (blob: Blob) => Promise<{ width: number; height: number; close?: () => void }>;
    OffscreenCanvas?: new (w: number, h: number) => { getContext: (t: "2d") => unknown };
    document?: { createElement: (tag: string) => { width: number; height: number; getContext: (t: "2d") => unknown } };
  };
  if (typeof g.createImageBitmap !== "function") return null;
  try {
    const blob = new Blob([data as BlobPart], { type: sniffType(data) });
    const bmp = await g.createImageBitmap(blob);
    const w = bmp.width;
    const h = bmp.height;
    if (!w || !h || w > 8000 || h > 8000) {
      bmp.close?.();
      return null;
    }
    let canvas: { getContext: (t: "2d") => unknown };
    if (typeof g.OffscreenCanvas === "function") {
      canvas = new g.OffscreenCanvas(w, h);
    } else if (g.document) {
      const c = g.document.createElement("canvas");
      c.width = w;
      c.height = h;
      canvas = c;
    } else {
      bmp.close?.();
      return null;
    }
    const ctx = canvas.getContext("2d") as {
      drawImage: (img: unknown, x: number, y: number) => void;
      getImageData: (x: number, y: number, ww: number, hh: number) => { data: ArrayLike<number> };
    } | null;
    if (!ctx) {
      bmp.close?.();
      return null;
    }
    ctx.drawImage(bmp, 0, 0);
    bmp.close?.();
    const rgba = ctx.getImageData(0, 0, w, h).data;
    const rgb = new Uint8Array(w * h * 3);
    const alpha = new Uint8Array(w * h);
    let anyTrans = false;
    for (let i = 0, j = 0, a = 0; i < rgba.length; i += 4, j += 3, a++) {
      const aa = rgba[i + 3] ?? 255;
      if (aa < 255) anyTrans = true;
      rgb[j] = rgba[i] ?? 0;
      rgb[j + 1] = rgba[i + 1] ?? 0;
      rgb[j + 2] = rgba[i + 2] ?? 0;
      alpha[a] = aa;
    }
    return { widthPx: w, heightPx: h, rgb, ...(anyTrans ? { alpha } : {}) };
  } catch {
    return null;
  }
}
