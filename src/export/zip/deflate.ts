/**
 * DEFLATE capability — Phase 10.6
 * Optional compression. The project includes a STORE fallback so packages are valid without DEFLATE,
 * at the cost of larger files. If a native or injected DEFLATE implementation is available, it is used.
 *
 * For Node, we can use zlib.deflateRawSync when available; for browsers, CompressionStream if present.
 * The interface is injected to keep core zero-deps and to allow deterministic tests (no compression).
 */

export interface DeflateCapability {
  deflate(data: Uint8Array): Uint8Array | Promise<Uint8Array>;
  method: number; // 8 = DEFLATE
}

export async function getNodeDeflate(): Promise<DeflateCapability | null> {
  try {
    const zlib = await import("node:zlib");
    return {
      method: 8,
      deflate: (data: Uint8Array) => new Uint8Array(zlib.deflateRawSync(data)),
    };
  } catch {
    return null;
  }
}

export async function getWebDeflate(): Promise<DeflateCapability | null> {
  const g = globalThis as unknown as { CompressionStream?: new (fmt: string) => unknown };
  if (!g.CompressionStream) return null;
  // Not implemented for MVP — would require async streaming
  return null;
}
