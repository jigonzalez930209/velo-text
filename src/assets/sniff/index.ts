/**
 * Asset sniffing — Fase 5.1.1
 * Detección por firma mágica, validación MIME declarado vs real, límites
 */
export type MediaType = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

export interface SniffResult {
  mediaType: MediaType | null;
  valid: boolean;
  reason?: string;
}

export function sniffImage(bytes: Uint8Array, declared?: string): SniffResult {
  if (bytes.length < 4) return { mediaType: null, valid: false, reason: "too-short" };

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const mediaType: MediaType = "image/png";
    if (declared && declared !== mediaType) return { mediaType, valid: false, reason: "mime-mismatch" };
    return { mediaType, valid: true };
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const mediaType: MediaType = "image/jpeg";
    if (declared && declared !== mediaType && declared !== "image/jpg") return { mediaType, valid: false, reason: "mime-mismatch" };
    return { mediaType, valid: true };
  }
  // WebP: RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    const header = new TextDecoder().decode(bytes.slice(8, 12));
    if (header === "WEBP") {
      const mediaType: MediaType = "image/webp";
      if (declared && declared !== mediaType) return { mediaType, valid: false, reason: "mime-mismatch" };
      return { mediaType, valid: true };
    }
  }
  // SVG: empieza con <svg o <?xml
  const head = new TextDecoder().decode(bytes.slice(0, 200)).trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) {
    const mediaType: MediaType = "image/svg+xml";
    if (declared && declared !== mediaType) return { mediaType, valid: false, reason: "mime-mismatch" };
    return { mediaType, valid: true };
  }
  return { mediaType: null, valid: false, reason: "unknown-format" };
}

export function isAllowedMediaType(mt: string): mt is MediaType {
  return ["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(mt);
}
