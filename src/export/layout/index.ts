import type { PortableDocument } from "../../core/model/types.js";
import { paginateDocument, type PaginationOptions, type LayoutPage as PaginatedPage, type PageBox as PaginatedBox } from "./pagination.js";
export * from "./units.js";
export * from "./text.js";
export * from "./pagination.js";

export type LayoutPage = PaginatedPage;
export type LayoutBox = PaginatedBox;

export interface LayoutModel {
  pages: LayoutPage[];
  diagnostics: Array<{ code: string; message: string; severity?: string }>;
  hash: string;
}

/**
 * Intermediate layout model — Phase 6
 * Now delegates to deterministic pagination with widows/orphans, table row handling and diagnostics.
 * No DOM dependency; runs identically in browser and backend.
 */
export function buildLayout(
  doc: PortableDocument,
  _assets: Record<string, unknown> = {},
  opts: PaginationOptions & Record<string, unknown> = {},
): LayoutModel {
  const result = paginateDocument(doc, opts);
  return {
    pages: result.pages,
    diagnostics: result.diagnostics as unknown as LayoutModel["diagnostics"],
    hash: result.hash,
  };
}
