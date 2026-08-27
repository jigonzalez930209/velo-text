/**
 * Canonical JSON — Fase 10.4 / 9.4
 * Arrays preservan orden, objetos con keys ordenadas, utf8 estable, hash sha256.
 */
import crypto from "node:crypto";
import type { PortableDocument } from "../model/types.js";

export function canonicalStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  function sortKeys(v: unknown): unknown {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) throw new Error("circular reference");
    if (Array.isArray(v)) {
      seen.add(v);
      const arr = (v as unknown[]).map(sortKeys);
      seen.delete(v);
      return arr;
    }
    seen.add(v as object);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const val = (v as Record<string, unknown>)[k];
      if (val !== undefined) out[k] = sortKeys(val);
    }
    seen.delete(v as object);
    return out;
  }
  const sorted = sortKeys(value);
  return JSON.stringify(sorted);
}

export function canonicalBytes(doc: PortableDocument): Buffer {
  return Buffer.from(canonicalStringify(doc), "utf8");
}

export function contentHash(doc: PortableDocument): Buffer {
  const bytes = canonicalBytes(doc);
  return crypto.createHash("sha256").update(bytes).digest();
}

export function contentHashHex(doc: PortableDocument): string {
  return contentHash(doc).toString("hex");
}
