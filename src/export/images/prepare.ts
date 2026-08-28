import type { PortableDocument } from "../../core/model/types.js";
import { umToPx } from "../layout/units.js";
import { decodeImageForPdf, type DecodedImage } from "../pdf/image.js";
import { decodeViaBitmap } from "./rasterize.js";

export interface PreparedAsset {
  id: string;
  mediaType: string;
  data: Uint8Array;
  decoded: DecodedImage | null;
}

export function targetEmbedPx(origW: number, origH: number, widthUm: number, heightUm: number): { w: number; h: number } {
  if (widthUm <= 0 && heightUm <= 0) return { w: origW, h: origH };
  const tw = widthUm > 0 ? Math.max(1, Math.round(umToPx(widthUm))) : Math.max(1, Math.round(origW * (umToPx(heightUm) / origH)));
  const th = heightUm > 0 ? Math.max(1, Math.round(umToPx(heightUm))) : Math.max(1, Math.round(origH * (tw / origW)));
  if (tw >= origW && th >= origH) return { w: origW, h: origH };
  const scale = Math.min(tw / origW, th / origH, 1);
  return { w: Math.max(1, Math.round(origW * scale)), h: Math.max(1, Math.round(origH * scale)) };
}

/**
 * Decode for PDF XObjects. Keep source pixels as-is (no downscale).
 * JPEG is DCT passthrough; PNG/WebP become RGB only when the PDF writer needs it.
 */
export async function prepareExportImages(
  _doc: PortableDocument,
  assets: Record<string, { id: string; mediaType: string; data: Uint8Array }>,
): Promise<Record<string, PreparedAsset>> {
  const out: Record<string, PreparedAsset> = {};
  for (const [id, ref] of Object.entries(assets)) {
    let decoded = await decodeImageForPdf(ref.data, ref.mediaType);
    if (!decoded || (!decoded.rgb && !decoded.jpeg) || decoded.widthPx === 0) {
      decoded = await decodeViaBitmap(ref.data);
    }
    out[id] = { id, mediaType: ref.mediaType, data: ref.data, decoded };
  }
  return out;
}
