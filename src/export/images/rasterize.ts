import type { DecodedImage } from "../pdf/image.js";

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
    const blob = new Blob([data as BlobPart]);
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
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      const a = (rgba[i + 3] ?? 255) / 255;
      rgb[j] = Math.round((rgba[i] ?? 0) * a + 255 * (1 - a));
      rgb[j + 1] = Math.round((rgba[i + 1] ?? 0) * a + 255 * (1 - a));
      rgb[j + 2] = Math.round((rgba[i + 2] ?? 0) * a + 255 * (1 - a));
    }
    return { widthPx: w, heightPx: h, rgb };
  } catch {
    return null;
  }
}
