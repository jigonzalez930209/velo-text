/** 1×1 gray PNG for DOCX consumers that cannot show SVG/WebP. */
export function placeholderPng(): Uint8Array {
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function needsRasterFallback(mediaType: string): boolean {
  return mediaType === "image/svg+xml" || mediaType === "image/webp";
}
