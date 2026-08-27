/**
 * PDF image support — Phase 7.2.2
 * Decodes PNG (RGB/RGBA, 8-bit) using an injected inflate (Node zlib or browser
 * DecompressionStream) and re-emits uncompressed RGB for PDF embedding.
 * JPEG is passed through as DCTDecode data (no decode needed).
 */

export interface DecodedImage {
  widthPx: number;
  heightPx: number;
  /** Raw RGB bytes (3 bytes per pixel) for uncompressed PDF embedding */
  rgb?: Uint8Array;
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
  const idat: Uint8Array[] = [];
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
    } else if (type === "IDAT") {
      idat.push(bytes.slice(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    pos = dataEnd + 4; // + CRC
  }
  if (!width || !height || bitDepth !== 8) return null;
  // Only truecolor RGB(2) and RGBA(6) supported for v1
  if (colorType !== 2 && colorType !== 6) return null;

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

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const rgb = new Uint8Array(width * height * 3);
  const prev = new Uint8Array(stride);
  let src = 0;
  for (let y = 0; y < height; y++) {
    if (src >= raw.length) return null;
    const filter = raw[src]!;
    src++;
    const cur = raw.subarray(src, src + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels]! : 0;
      const b = prev[x]!;
      const c = x >= channels ? prev[x - channels]! : 0;
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
      rgb[(y * width + x) * 3] = cur[x * channels]!;
      rgb[(y * width + x) * 3 + 1] = cur[x * channels + 1]!;
      rgb[(y * width + x) * 3 + 2] = cur[x * channels + 2]!;
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

/**
 * Decode an image for PDF embedding. Tries PNG decode (sync via cache); JPEG passes through.
 */
export async function decodeImageForPdf(data: Uint8Array, mediaType: string): Promise<DecodedImage | null> {
  if (mediaType === "image/jpeg") {
    return { widthPx: 0, heightPx: 0, jpeg: data };
  }
  if (mediaType === "image/png") {
    const infl = await getInflate();
    return decodePngImage(data, infl ?? undefined);
  }
  return null;
}

export async function ensureInflateLoaded(): Promise<void> {
  await getInflate();
}