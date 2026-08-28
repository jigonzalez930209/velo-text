/**
 * PDF image support — Phase 7.2.2
 * Decodes PNG (RGB/RGBA, 8-bit) using an injected inflate (Node zlib or browser
 * DecompressionStream) and re-emits uncompressed RGB for PDF embedding.
 * JPEG is passed through as DCTDecode data (no decode needed).
 */

import { getJpegDimensions } from "../../assets/dimensions/index.js";
import { sniffImage } from "../../assets/sniff/index.js";

export interface DecodedImage {
  widthPx: number;
  heightPx: number;
  /** Raw RGB bytes (3 bytes per pixel) for uncompressed PDF embedding */
  rgb?: Uint8Array;
  /** Optional DeviceGray alpha for /SMask (transparent SVG corners) */
  alpha?: Uint8Array;
  /** Raw JPEG bytes for DCTDecode embedding */
  jpeg?: Uint8Array;
}

type InflateFn = (data: Uint8Array) => Uint8Array | Promise<Uint8Array>;

async function getNodeInflate(): Promise<InflateFn | null> {
  try {
    const zlib = await import("node:zlib");
    return (data: Uint8Array) => new Uint8Array(zlib.inflateSync(data));
  } catch {
    return null;
  }
}

async function getBrowserInflate(): Promise<InflateFn | null> {
  const g = globalThis as unknown as { DecompressionStream?: new (fmt: string) => { readable: ReadableStream } };
  if (!g.DecompressionStream) return null;
  return async (data: Uint8Array): Promise<Uint8Array> => {
    const ds = new (g.DecompressionStream as new (fmt: string) => { readable: ReadableStream; writable: WritableStream })("deflate");
    const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(ds as unknown as { writable: WritableStream; readable: ReadableStream });
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  };
}

let inflateCache: InflateFn | null | undefined;

export async function getInflate(): Promise<InflateFn | null> {
  if (inflateCache !== undefined) return inflateCache;
  inflateCache = (await getNodeInflate()) ?? (await getBrowserInflate());
  return inflateCache;
}

// ── PNG decode ──
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export async function decodePngImage(bytes: Uint8Array, inflate?: InflateFn): Promise<DecodedImage | null> {
  // Signature check
  if (bytes.length < 33 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Uint8Array[] = [];
  let plte: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const len = view.getUint32(pos, false);
    const type = String.fromCharCode(bytes[pos + 4]!, bytes[pos + 5]!, bytes[pos + 6]!, bytes[pos + 7]!);
    const dataStart = pos + 8;
    const dataEnd = dataStart + len;
    if (type === "IHDR") {
      width = view.getUint32(dataStart, false);
      height = view.getUint32(dataStart + 4, false);
      bitDepth = bytes[dataStart + 8]!;
      colorType = bytes[dataStart + 9]!;
      interlace = bytes[dataStart + 12]!;
    } else if (type === "PLTE") {
      plte = bytes.slice(dataStart, dataEnd);
    } else if (type === "tRNS") {
      trns = bytes.slice(dataStart, dataEnd);
    } else if (type === "IDAT") {
      idat.push(bytes.slice(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    pos = dataEnd + 4; // + CRC
  }
  if (!width || !height || interlace) return null;
  const okTruecolor = (colorType === 2 || colorType === 6) && bitDepth === 8;
  const okGray = (colorType === 0 || colorType === 4) && bitDepth === 8;
  const okIndexed = colorType === 3 && (bitDepth === 4 || bitDepth === 8) && plte && plte.length >= 3;
  if (!okTruecolor && !okGray && !okIndexed) return null;

  const infl = inflate ?? inflateCache ?? null;
  if (!infl) return null;
  let raw: Uint8Array;
  try {
    const merged = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
    let off = 0;
    for (const d of idat) { merged.set(d, off); off += d.length; }
    const result = infl(merged);
    raw = await result;
  } catch {
    return null;
  }

  const samples =
    colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 4 ? 2 : 1;
  const bitsPerPixel = samples * bitDepth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const filterBpp = Math.max(1, Math.floor(bitsPerPixel / 8));
  const rgb = new Uint8Array(width * height * 3);
  const prev = new Uint8Array(stride);
  let src = 0;
  for (let y = 0; y < height; y++) {
    if (src + 1 + stride > raw.length) return null;
    const filter = raw[src]!;
    src++;
    const cur = raw.subarray(src, src + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= filterBpp ? cur[x - filterBpp]! : 0;
      const b = prev[x]!;
      const c = x >= filterBpp ? prev[x - filterBpp]! : 0;
      let v = cur[x]!;
      switch (filter) {
        case 0: break;
        case 1: v = (v + a) & 0xff; break;
        case 2: v = (v + b) & 0xff; break;
        case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
        case 4: v = (v + paeth(a, b, c)) & 0xff; break;
        default: return null;
      }
      cur[x] = v;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3;
      if (colorType === 2 || colorType === 6) {
        rgb[o] = cur[x * samples]!;
        rgb[o + 1] = cur[x * samples + 1]!;
        rgb[o + 2] = cur[x * samples + 2]!;
        if (colorType === 6) {
          const a = cur[x * samples + 3]! / 255;
          rgb[o] = Math.round(rgb[o]! * a + 255 * (1 - a));
          rgb[o + 1] = Math.round(rgb[o + 1]! * a + 255 * (1 - a));
          rgb[o + 2] = Math.round(rgb[o + 2]! * a + 255 * (1 - a));
        }
      } else if (colorType === 0) {
        const g = cur[x]!;
        rgb[o] = g; rgb[o + 1] = g; rgb[o + 2] = g;
      } else if (colorType === 4) {
        const g = cur[x * 2]!;
        const a = cur[x * 2 + 1]! / 255;
        const v = Math.round(g * a + 255 * (1 - a));
        rgb[o] = v; rgb[o + 1] = v; rgb[o + 2] = v;
      } else {
        const idx = bitDepth === 8
          ? cur[x]!
          : (x % 2 === 0 ? (cur[x >> 1]! >> 4) : (cur[x >> 1]! & 0x0f));
        const pi = idx * 3;
        if (!plte || pi + 2 >= plte.length) return null;
        let r = plte[pi]!, gch = plte[pi + 1]!, bch = plte[pi + 2]!;
        if (trns && idx < trns.length) {
          const a = trns[idx]! / 255;
          r = Math.round(r * a + 255 * (1 - a));
          gch = Math.round(gch * a + 255 * (1 - a));
          bch = Math.round(bch * a + 255 * (1 - a));
        }
        rgb[o] = r; rgb[o + 1] = gch; rgb[o + 2] = bch;
      }
    }
    prev.set(cur);
    src += stride;
  }
  return { widthPx: width, heightPx: height, rgb };
}

/**
 * Re-encode RGB data as PDF raw image bytes (no filter, no compression).
 */
export function encodeRgbImageData(rgb: Uint8Array, width: number, height: number): Uint8Array {
  return rgb; // RGB scanlines are directly embeddable when uncompressed
}

export async function decodeImageForPdf(data: Uint8Array, mediaType: string): Promise<DecodedImage | null> {
  const sniffed = sniffImage(data).mediaType;
  const mt = sniffed ?? mediaType;
  if (mt === "image/jpeg" || mt === "image/jpg" || mediaType === "image/jpg") {
    const dim = getJpegDimensions(data);
    return { widthPx: dim?.widthPx ?? 0, heightPx: dim?.heightPx ?? 0, jpeg: data };
  }
  if (mt === "image/png") {
    const infl = await getInflate();
    return decodePngImage(data, infl ?? undefined);
  }
  if (mt === "image/svg+xml" || mediaType === "image/svg+xml") {
    const raster = await rasterizeSvg(data);
    if (raster) return raster;
    const { placeholderPng } = await import("../../assets/png/placeholder.js");
    const infl = await getInflate();
    return decodePngImage(placeholderPng(), infl ?? undefined);
  }
  return null;
}

async function rasterizeSvg(data: Uint8Array): Promise<DecodedImage | null> {
  const g = globalThis as unknown as { document?: { createElement: (t: string) => HTMLCanvasElement }; Image?: new () => HTMLImageElement; URL?: typeof URL };
  if (!g.document || !g.Image || !g.URL) return null;
  const blob = new Blob([data as unknown as BlobPart], { type: "image/svg+xml" });
  const url = g.URL.createObjectURL(blob);
  try {
    const img = new g.Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg"));
      img.src = url;
    });
    const canvas = g.document.createElement("canvas");
    canvas.width = Math.max(1, img.naturalWidth || 200);
    canvas.height = Math.max(1, img.naturalHeight || 80);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const raw = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const rgb = new Uint8Array(canvas.width * canvas.height * 3);
    const alpha = new Uint8Array(canvas.width * canvas.height);
    let anyTrans = false;
    for (let i = 0, j = 0, a = 0; i < raw.length; i += 4, j += 3, a++) {
      const aa = raw[i + 3] ?? 255;
      if (aa < 255) anyTrans = true;
      rgb[j] = raw[i]!;
      rgb[j + 1] = raw[i + 1]!;
      rgb[j + 2] = raw[i + 2]!;
      alpha[a] = aa;
    }
    return { widthPx: canvas.width, heightPx: canvas.height, rgb, ...(anyTrans ? { alpha } : {}) };
  } catch {
    return null;
  } finally {
    g.URL.revokeObjectURL(url);
  }
}

export async function ensureInflateLoaded(): Promise<void> {
  await getInflate();
}