/**
 * Area-average RGB downscale. Used when export size is smaller than the source pixels.
 */
export function downsampleRgb(src: Uint8Array, sw: number, sh: number, dw: number, dh: number): Uint8Array {
  if (dw < 1 || dh < 1 || sw < 1 || sh < 1) return new Uint8Array(0);
  if (dw === sw && dh === sh) return src;
  const dst = new Uint8Array(dw * dh * 3);
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor((y * sh) / dh);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor((x * sw) / dw);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * sw) / dw));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = y0; sy < y1 && sy < sh; sy++) {
        for (let sx = x0; sx < x1 && sx < sw; sx++) {
          const i = (sy * sw + sx) * 3;
          r += src[i]!;
          g += src[i + 1]!;
          b += src[i + 2]!;
          n++;
        }
      }
      const o = (y * dw + x) * 3;
      dst[o] = Math.round(r / n);
      dst[o + 1] = Math.round(g / n);
      dst[o + 2] = Math.round(b / n);
    }
  }
  return dst;
}

/** Largest display size of `assetId` in the document (µm). */
export function maxImageDisplayUm(
  blocks: Array<{ type: string; assetId?: string; widthUm?: number; heightUm?: number; rows?: unknown; columns?: unknown; cells?: unknown; blocks?: unknown }>,
  assetId: string,
): { widthUm: number; heightUm: number } | null {
  let widthUm = 0;
  let heightUm = 0;
  const walk = (list: typeof blocks): void => {
    for (const b of list) {
      if (b.type === "image" && b.assetId === assetId) {
        widthUm = Math.max(widthUm, b.widthUm ?? 0);
        heightUm = Math.max(heightUm, b.heightUm ?? 0);
      }
      if (b.type === "table" && Array.isArray(b.rows)) {
        for (const row of b.rows as Array<{ cells: Array<{ blocks: typeof blocks }> }>) {
          for (const cell of row.cells) walk(cell.blocks);
        }
      }
      if (b.type === "columns" && Array.isArray(b.columns)) {
        for (const col of b.columns as Array<{ blocks: typeof blocks }>) walk(col.blocks);
      }
    }
  };
  walk(blocks);
  if (!widthUm && !heightUm) return null;
  return { widthUm, heightUm };
}
