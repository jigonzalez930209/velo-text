export type SlotKind =
  | "variable"
  | "table"
  | "table-repeat"
  | "image"
  | "inline-image"
  | "equation"
  | "equation-block"
  | "columns";

export interface DocumentSlot {
  id: string;
  kind: SlotKind;
  /** JSON-pointer-like path into the AST. */
  pointer: string;
  /**
   * Inject key: variable `path`, image `assetId`, table `repeat.path` or node id.
   * Matches the tags the editor already stores (`{{path}}`, `data-asset-id`).
   */
  tag: string;
  path?: string;
  assetId?: string;
  format?: string;
  fallback?: string;
  latex?: string;
  repeat?: { path: string; alias: string };
}
