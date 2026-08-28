import type { BinarySink } from "../../core/model/types.js";
import fs from "node:fs";
import path from "node:path";

export function createFileSink(filePath: string): BinarySink {
  const chunks: Uint8Array[] = [];
  return {
    write(chunk: Uint8Array): void {
      chunks.push(chunk);
    },
    async close(): Promise<void> {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        out.set(c, off);
        off += c.length;
      }
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, out);
    },
  };
}

export function createBufferSink(): { sink: BinarySink; getBuffer: () => Uint8Array } {
  const chunks: Uint8Array[] = [];
  return {
    sink: {
      write(chunk: Uint8Array): void {
        chunks.push(chunk);
      },
      close(): void {},
    },
    getBuffer(): Uint8Array {
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        out.set(c, off);
        off += c.length;
      }
      return out;
    },
  };
}
