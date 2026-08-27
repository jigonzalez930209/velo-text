/**
 * Dimensiones sin decodificar imagen completa — Fase 5.1.2
 * PNG, JPEG, WebP lectura de cabecera
 */
export interface Dimensions {
  widthPx: number;
  heightPx: number;
}

export function getPngDimensions(bytes: Uint8Array): Dimensions | null {
  if (bytes.length < 24) return null;
  // IHDR at offset 16: width 4 bytes BE, height 4 bytes BE
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // verify PNG sig already done
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (width === 0 || height === 0 || width > 10000 || height > 10000) return null;
  return { widthPx: width, heightPx: height };
}

export function getJpegDimensions(bytes: Uint8Array): Dimensions | null {
  // scan markers for SOF0/2
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1]!;
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (marker >= 0xc0 && marker <= 0xc3) {
      const h = (bytes[i + 5]! << 8) | bytes[i + 6]!;
      const w = (bytes[i + 7]! << 8) | bytes[i + 8]!;
      return { widthPx: w, heightPx: h };
    }
    i += 2 + len;
  }
  return null;
}

export function getDimensions(bytes: Uint8Array, mediaType: string): Dimensions | null {
  if (mediaType === "image/png") return getPngDimensions(bytes);
  if (mediaType === "image/jpeg") return getJpegDimensions(bytes);
  return null;
}
