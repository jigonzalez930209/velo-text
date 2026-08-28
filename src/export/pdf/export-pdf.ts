/**
 * Canonical PDF export — playground preview and backend (Express/Vercel) must call this.
 * No DOM. Same bytes for the same document + data + assets + clock.
 */
import type { PortableDocument, Clock, IdGenerator, BinarySink } from "../../core/model/types.js";
import { validateDocument } from "../../core/schema/validator.js";
import { renderTemplate, type RenderOptions } from "../../template/resolver/resolver.js";
import { PdfWriter } from "./writer.js";
import { collectPdfDiagnostics, type PdfDiag } from "./diagnostics.js";

export type { PdfDiag };
export { collectPdfDiagnostics };

export interface ExportPdfRequest {
  document: PortableDocument;
  data?: Record<string, unknown>;
  assets?: Record<string, { id: string; mediaType: string; data: Uint8Array }>;
  options?: RenderOptions & { strict?: boolean; missingVariable?: "error" | "empty" | "keep" };
  clock?: Clock;
  idGenerator?: IdGenerator;
  sink?: BinarySink;
}

export interface ExportPdfResult {
  bytes: Uint8Array;
  diagnostics: PdfDiag[];
  pages: number;
  byteLength: number;
}

export async function exportPdf(req: ExportPdfRequest): Promise<ExportPdfResult> {
  const { document, data = {}, assets = {}, options = {} } = req;
  const strict = options.strict ?? true;
  const validation = validateDocument(document, { strict });
  if (!validation.valid && strict) {
    throw new Error(`Document invalid: ${validation.errors.slice(0, 3).map((e) => e.message).join("; ")}`);
  }
  const rendered = renderTemplate(document, data, {
    locale: document.locale,
    missing: (options.missingVariable as RenderOptions["missing"]) ?? (strict ? "error" : "keep"),
    mode: strict ? "strict" : "tolerant",
  });
  if (rendered.diagnostics.some((d) => d.severity === "error") && strict) {
    throw new Error(`Render failed: ${rendered.diagnostics.filter((d) => d.severity === "error").map((d) => d.message ?? d.code).join("; ")}`);
  }
  const chunks: Uint8Array[] = [];
  const mem: BinarySink = {
    write(c) { chunks.push(c); },
    close() {},
  };
  const w = new PdfWriter({ clock: req.clock, idGenerator: req.idGenerator });
  const written = await w.write(rendered.document, mem, assets);
  const bytes = join(chunks);
  if (req.sink) {
    await req.sink.write(bytes);
    await req.sink.close?.();
  }
  const pdfDiags = collectPdfDiagnostics(rendered.document, assets);
  const diagnostics: PdfDiag[] = [
    ...rendered.diagnostics.map((d) => ({
      code: d.code,
      message: d.message ?? d.code,
      severity: (d.severity === "error" ? "error" : "warning") as "warning" | "error",
    })),
    ...pdfDiags,
  ];
  return { bytes, diagnostics, pages: written.pages, byteLength: bytes.length };
}

function join(chunks: Uint8Array[]): Uint8Array {
  const n = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
