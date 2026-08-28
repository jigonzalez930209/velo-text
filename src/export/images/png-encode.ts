/**
 * RGB → PNG (8-bit truecolor). IDAT uses uncompressed DEFLATE stored blocks
 * so encoding is deterministic and has no runtime dependencies.
 */
import { crc32 } from "../zip/crc32.js";

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a += data[i]!;
    if (a >= 65521) a -= 65521;
    b += a;
    if (b >= 65521) b -= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** zlib-wrapped uncompressed DEFLATE (CMF/FLG + stored blocks + Adler-32). */
export function zlibStore(raw: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  if (raw.length === 0) {
    parts.push(new Uint8Array([0x01, 0x00, 0x00, 0xff, 0xff]));
  } else {
    let off = 0;
    while (off < raw.length) {
      const n = Math.min(65535, raw.length - off);
      const last = off + n >= raw.length;
      const header = new Uint8Array(5);
      header[0] = last ? 0x01 : 0x00;
      header[1] = n & 0xff;
      header[2] = (n >> 8) & 0xff;
      const nlen = (~n) & 0xffff;
      header[3] = nlen & 0xff;
      header[4] = (nlen >> 8) & 0xff;
      parts.push(header, raw.subarray(off, off + n));
      off += n;
    }
  }
  const trail = new Uint8Array(4);
  new DataView(trail.buffer).setUint32(0, adler32(raw), false);
  parts.push(trail);
  return concat(parts);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length, false);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  const crcSrc = out.subarray(4, 8 + data.length);
  view.setUint32(8 + data.length, crc32(crcSrc), false);
  return out;
}

export function encodePngRgb(rgb: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * 3;
  const raw = new Uint8Array(height * (1 + stride));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + stride);
    raw[row] = 0;
    raw.set(rgb.subarray(y * stride, (y + 1) * stride), row + 1);
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width, false);
  v.setUint32(4, height, false);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlibStore(raw)), chunk("IEND", new Uint8Array(0))]);
}
