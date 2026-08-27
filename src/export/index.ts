export * from "./xml/writer.js";
export * from "./zip/index.js";
export * from "./pdf/writer.js";
export * from "./odt/writer.js";
export * from "./docx/writer.js";
export * from "./layout/index.js";

import type { PortableDocument, BinarySink, Clock, IdGenerator, AssetResolver } from "../core/model/types.js";
import { renderTemplate, type RenderOptions } from "../template/resolver/resolver.js";
import { validateDocument } from "../core/schema/validator.js";
import { PdfWriter } from "./pdf/writer.js";
import { OdtWriter } from "./odt/writer.js";
import { DocxWriter } from "./docx/writer.js";

export type ExportFormat = "pdf" | "odt" | "docx";

export interface ExportRequest {
  document: PortableDocument;
  data?: Record<string, unknown>;
  format: ExportFormat;
  assets?: Record<string, { id: string; mediaType: string; data: Uint8Array }>;
  sink: BinarySink;
  options?: RenderOptions & {
    deterministic?: boolean;
    strict?: boolean;
    imagePolicy?: string;
    missingVariable?: "error" | "empty" | "keep";
  };
  clock?: Clock;
  idGenerator?: IdGenerator;
  assetResolver?: AssetResolver;
}

export interface ExportResult {
  byteLength: number;
  diagnostics: Array<{ code: string; message?: string; severity?: string; path?: string }>;
  format: ExportFormat;
}

/**
 * Common pipeline — Phase 10
 * validate+migrate -> resolve variables -> resolve assets -> normalize -> layout -> adapt -> package
 */
export async function exportDocument(req: ExportRequest): Promise<ExportResult> {
  const { document, data = {}, format, sink, options = {}, assets = {} } = req;

  // 1. validar
  const validation = validateDocument(document, { strict: options.strict ?? true });
  if (!validation.valid && (options.strict ?? true)) {
    throw new Error(`Document invalid: ${validation.errors.slice(0, 3).map((e) => e.message).join("; ")}`);
  }

  // 2. resolver variables
  const rendered = renderTemplate(document, data as Record<string, unknown>, {
    locale: document.locale,
    missing: (options.missingVariable as RenderOptions["missing"]) ?? "error",
    mode: (options.strict ?? true) ? "strict" : "tolerant",
  });

  if (rendered.diagnostics.some((d) => d.severity === "error") && (options.strict ?? true)) {
    throw new Error(`Render failed: ${rendered.diagnostics.filter((d) => d.severity === "error").map((d) => d.message ?? d.code).join("; ")}`);
  }

  // 3. writer por formato
  const clock = req.clock ?? { nowIso: () => new Date().toISOString() };
  switch (format) {
    case "pdf": {
      const w = new PdfWriter({ clock, idGenerator: req.idGenerator });
      const res = await w.write(rendered.document, sink, assets);
      return { byteLength: res.byteLength, diagnostics: rendered.diagnostics, format };
    }
    case "odt": {
      const w = new OdtWriter({ clock });
      const res = await w.write(rendered.document, assets, sink);
      return { byteLength: res.byteLength, diagnostics: rendered.diagnostics, format };
    }
    case "docx": {
      const w = new DocxWriter({ clock });
      const res = await w.write(rendered.document, assets, sink);
      return { byteLength: res.byteLength, diagnostics: rendered.diagnostics, format };
    }
    default:
      throw new Error(`Unsupported format ${format as string}`);
  }
}
