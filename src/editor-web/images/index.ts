/**
 * Imágenes — Fase 4 / 5
 * Pipeline de subida: validación, sniff, dimensiones, hash, URL firmada
 */
import { sniffImage } from "../../assets/sniff/index.js";
import { getDimensions } from "../../assets/dimensions/index.js";

export interface ImageValidationResult {
  valid: boolean;
  mediaType?: string;
  widthPx?: number;
  heightPx?: number;
  reason?: string;
}

export function validateImageBytes(bytes: Uint8Array, declaredType?: string, maxBytes = 10_000_000, maxDim = 8000): ImageValidationResult {
  if (bytes.length > maxBytes) return { valid: false, reason: "too-large" };
  const sniff = sniffImage(bytes, declaredType);
  if (!sniff.valid || !sniff.mediaType) return { valid: false, reason: sniff.reason ?? "invalid-format" };
  const dims = getDimensions(bytes, sniff.mediaType);
  if (dims && (dims.widthPx > maxDim || dims.heightPx > maxDim)) return { valid: false, reason: "dimensions-too-large" };
  return { valid: true, mediaType: sniff.mediaType, widthPx: dims?.widthPx, heightPx: dims?.heightPx };
}
