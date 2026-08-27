/**
 * Hashing — Fase 5.1.2
 * SHA-256 para deduplicación
 */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Usa Web Crypto si disponible, fallback a implementación sync en node
  const g = globalThis as unknown as { crypto?: { subtle?: { digest(a: string, b: BufferSource): Promise<ArrayBuffer> } } };
  if (g.crypto?.subtle) {
    const buf = await g.crypto.subtle.digest("SHA-256", bytes as BufferSource);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // node fallback via dynamic import para no romper browser
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha256HexSync(bytes: Uint8Array): string {
  // sync solo en node - para tests deterministas
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(bytes).digest("hex");
}
