/**
 * PdfWriter — Phase 7 (hardened)
 * Deterministic PDF with real text positioning, LaTeX equations (Helvetica + Symbol),
 * tables (grid + cell text) and PNG/JPEG images as XObjects.
 */
import type { PortableDocument, BinarySink, Clock, IdGenerator } from "../../core/model/types.js";
import { decodeImageForPdf, type DecodedImage } from "./image.js";
import { assemblePdf } from "./assemble.js";
import { buildPdfPages } from "./layout-pages.js";
export type { PdfWriteResult } from "./pdf-model.js";
import type { PdfWriteResult } from "./pdf-model.js";

export class PdfWriter {
  private readonly clock: Clock;
  private readonly idGenerator: IdGenerator;

  constructor(opts: { clock?: Clock; idGenerator?: IdGenerator } = {}) {
    this.clock = opts.clock ?? { nowIso: () => new Date().toISOString() };
    let c = 0;
    this.idGenerator = opts.idGenerator ?? { next: () => `pdf_${++c}` };
  }

  async write(
    layoutOrDoc: PortableDocument | { document: PortableDocument },
    sink: BinarySink,
    assets?: Record<string, { id: string; mediaType: string; data: Uint8Array; widthPx?: number; heightPx?: number }>,
  ): Promise<PdfWriteResult> {
    void this.idGenerator;
    const doc: PortableDocument =
      (layoutOrDoc as { document: PortableDocument }).document ?? (layoutOrDoc as PortableDocument);
    const pages = buildPdfPages(doc);
    const decoded = new Map<string, DecodedImage | null>();
    for (const [id, ref] of Object.entries(assets ?? {})) {
      decoded.set(id, await decodeImageForPdf(ref.data, ref.mediaType));
    }
    const pdfBytes = assemblePdf(pages, doc, assets ?? {}, decoded, this.clock);
    await sink.write(pdfBytes);
    await sink.close?.();
    return { byteLength: pdfBytes.length, pages: pages.length };
  }
}
