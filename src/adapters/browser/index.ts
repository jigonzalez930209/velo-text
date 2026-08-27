import type { BinarySink, AssetResolver, ResolvedAsset } from "../../core/model/types.js";

export function createBlobSink(): { sink: BinarySink; getBlob: () => Blob } {
  const chunks: Uint8Array[] = [];
  return {
    sink: {
      write(chunk: Uint8Array): void {
        chunks.push(chunk);
      },
      close(): void {},
    },
    getBlob(): Blob {
      return new Blob(chunks as BlobPart[], { type: "application/octet-stream" });
    },
  };
}

export function createMemorySink(): { sink: BinarySink; getBytes: () => Uint8Array } {
  const chunks: Uint8Array[] = [];
  let closed = false;
  return {
    sink: {
      write(chunk: Uint8Array): void {
        if (closed) throw new Error("sink closed");
        chunks.push(chunk);
      },
      close(): void {
        closed = true;
      },
    },
    getBytes(): Uint8Array {
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

export function createBrowserAssetResolver(map: Record<string, ResolvedAsset>): AssetResolver {
  return {
    async resolve(assetId: string): Promise<ResolvedAsset> {
      const a = map[assetId];
      if (!a) throw new Error(`asset ${assetId} not found`);
      return a;
    },
  };
}
