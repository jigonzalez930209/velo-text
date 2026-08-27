/**
 * ZipWriter — Phase 10.6
 * STORE mandatory, DEFLATE optional via injected capability, streaming when sink allows.
 * The mimetype entry must be first and uncompressed (STORE) for ODT compliance.
 */
import { crc32 } from "./crc32.js";
import type { BinarySink } from "../../core/model/types.js";

function encodeUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}
function writeUint16LE(arr: number[], v: number): void {
  arr.push(v & 0xff, (v >>> 8) & 0xff);
}
function writeUint32LE(arr: number[], v: number): void {
  arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}

interface ZipEntry {
  name: string;
  data: Uint8Array; // original uncompressed
  compressedData?: Uint8Array;
  method: number; // 0 STORE, 8 DEFLATE
  mtime: Date;
  crc: number;
}

export interface ZipWriterOptions {
  // Optional DEFLATE capability — if not provided, all entries use STORE (larger but always valid)
  deflate?: { deflate: (data: Uint8Array) => Uint8Array | Promise<Uint8Array>; method: number };
  // Deterministic mtime for tests
  defaultMtime?: Date;
}

export class ZipWriter {
  private files: ZipEntry[] = [];
  constructor(private readonly opts: ZipWriterOptions = {}) {}

  add(name: string, data: Uint8Array | string, opts: { method?: number; mtime?: Date; comment?: string } = {}): void {
    let bytes: Uint8Array = typeof data === "string" ? encodeUtf8(data) : data;
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    // Enforce STORE for mimetype (ODT spec)
    const method = name === "mimetype" ? 0 : (opts.method ?? 0);
    const crc = crc32(bytes);
    this.files.push({ name, data: bytes, method, mtime: opts.mtime ?? this.opts.defaultMtime ?? new Date(), crc });
  }

  /** If DEFLATE is available and requested, compress synchronously for build() */
  private getCompressed(entry: ZipEntry): { data: Uint8Array; method: number } {
    if (entry.method === 8 && this.opts.deflate) {
      try {
        const res = this.opts.deflate.deflate(entry.data);
        // If async, fallback to STORE for sync build()
        if (res instanceof Promise) return { data: entry.data, method: 0 };
        return { data: res as Uint8Array, method: 8 };
      } catch {
        return { data: entry.data, method: 0 };
      }
    }
    return { data: entry.data, method: 0 };
  }

  build(): Uint8Array {
    const out: number[] = [];
    const central: Array<{ bytes: Uint8Array; offset: number }> = [];
    let offset = 0;

    const mtimeToDos = (d: Date): { time: number; date: number } => {
      const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
      const date = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
      return { time, date };
    };

    for (const f of this.files) {
      const nameBytes = encodeUtf8(f.name);
      const { data: compressed, method: actualMethod } = this.getCompressed(f);
      const { time, date } = mtimeToDos(f.mtime);
      const localHeader: number[] = [];
      writeUint32LE(localHeader, 0x04034b50);
      writeUint16LE(localHeader, 20);
      writeUint16LE(localHeader, 0x0800); // utf8
      writeUint16LE(localHeader, actualMethod);
      writeUint16LE(localHeader, time);
      writeUint16LE(localHeader, date);
      writeUint32LE(localHeader, f.crc);
      writeUint32LE(localHeader, compressed.length); // compressed size
      writeUint32LE(localHeader, f.data.length); // uncompressed size
      writeUint16LE(localHeader, nameBytes.length);
      writeUint16LE(localHeader, 0);
      const localStart = offset;
      out.push(...localHeader, ...nameBytes);
      offset += localHeader.length + nameBytes.length;
      out.push(...compressed);
      offset += compressed.length;

      const cd: number[] = [];
      writeUint32LE(cd, 0x02014b50);
      writeUint16LE(cd, 20);
      writeUint16LE(cd, 20);
      writeUint16LE(cd, 0x0800);
      writeUint16LE(cd, actualMethod);
      writeUint16LE(cd, time);
      writeUint16LE(cd, date);
      writeUint32LE(cd, f.crc);
      writeUint32LE(cd, compressed.length);
      writeUint32LE(cd, f.data.length);
      writeUint16LE(cd, nameBytes.length);
      writeUint16LE(cd, 0);
      writeUint16LE(cd, 0);
      writeUint16LE(cd, 0);
      writeUint16LE(cd, 0);
      writeUint32LE(cd, 0);
      writeUint32LE(cd, localStart);
      central.push({ bytes: new Uint8Array([...cd, ...nameBytes]), offset: localStart });
    }

    const centralStart = offset;
    let centralSize = 0;
    for (const c of central) {
      out.push(...c.bytes);
      offset += c.bytes.length;
      centralSize += c.bytes.length;
    }
    const eocd: number[] = [];
    writeUint32LE(eocd, 0x06054b50);
    writeUint16LE(eocd, 0);
    writeUint16LE(eocd, 0);
    writeUint16LE(eocd, this.files.length);
    writeUint16LE(eocd, this.files.length);
    writeUint32LE(eocd, centralSize);
    writeUint32LE(eocd, centralStart);
    writeUint16LE(eocd, 0);
    out.push(...eocd);
    return new Uint8Array(out);
  }

  async writeToSink(sink: BinarySink): Promise<number> {
    const bytes = this.build();
    await sink.write(bytes);
    await sink.close?.();
    return bytes.length;
  }
}
