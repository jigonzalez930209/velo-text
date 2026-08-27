/**
 * Canonical types — Phase 2.1.1 / 5.x
 * PortableDocument envelope + nodes + assets + selection.
 * Measurements in micrometers (integers), colors as #RRGGBBAA, dates as ISO8601 UTC.
 */

export const SCHEMA_VERSION = 1 as const;
export const SCHEMA_TYPE = "portable-doc" as const;

export type NodeId = string;
export type AssetId = string;
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface PageSettings {
  widthUm: number;
  heightUm: number;
  marginUm: { top: number; right: number; bottom: number; left: number };
  orientation?: "portrait" | "landscape";
}

export interface TextMarks {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  color?: string; // #RRGGBBAA
  background?: string;
  fontSizePt?: number;
  fontFamily?: string;
}

// ── Inline ──────────────────────────────────────────────────────────
export interface TextNode {
  type: "text";
  id: NodeId;
  text: string;
  marks?: TextMarks;
}

export interface VariableNode {
  type: "variable";
  id: NodeId;
  path: string;
  source: string;
  valueType: "string" | "number" | "date" | "boolean" | "image" | "unknown";
  format?: string;
  fallback?: string;
  marks?: TextMarks;
}

export interface LinkNode {
  type: "link";
  id: NodeId;
  href: string;
  children: Array<TextNode | VariableNode>;
  title?: string;
}

export interface InlineImageNode {
  type: "inline-image";
  id: NodeId;
  assetId: AssetId;
  widthUm?: number;
  heightUm?: number;
}

export interface HardBreakNode {
  type: "hard-break";
  id: NodeId;
}

/**
 * Inline LaTeX equation — simple subset.
 * Stores raw LaTeX source; rendering is pluggable (web: HTML/CSS, export: fallback text or OMML).
 * Example: "E = mc^2", "\\frac{a}{b}", "\\sqrt{x}".
 * Max length enforced by validator; content is atomic (contenteditable=false).
 */
export interface InlineEquationNode {
  type: "equation";
  id: NodeId;
  latex: string;
  display?: boolean; // false (default) = inline, true = display block inside paragraph
}

export type InlineNode = TextNode | VariableNode | LinkNode | InlineImageNode | HardBreakNode | InlineEquationNode;

// ── Block ───────────────────────────────────────────────────────────
export interface ParagraphNode {
  type: "paragraph";
  id: NodeId;
  children: InlineNode[];
  align?: "left" | "center" | "right" | "justify";
  indentLevel?: number;
  style?: Record<string, JsonValue>;
}

export interface HeadingNode {
  type: "heading";
  id: NodeId;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
}

export interface QuoteNode {
  type: "quote";
  id: NodeId;
  children: InlineNode[];
}

export interface ListItemNode {
  id: NodeId;
  content: InlineNode[];
  nested?: ListNode;
}

export interface ListNode {
  type: "list";
  id: NodeId;
  kind: "ordered" | "unordered";
  items: ListItemNode[];
}

export interface TableColumn {
  id: string;
  widthUm: number;
}

export interface TableCell {
  id: NodeId;
  colSpan: number;
  rowSpan: number;
  blocks: BlockNode[];
  style?: Record<string, JsonValue>;
}

export interface TableRow {
  id: NodeId;
  cells: TableCell[];
  header?: boolean;
  /** Optional row height in micrometers (set by row resize) */
  heightUm?: number;
}

export interface TableStyle {
  border?: string;
  width?: string;
}

export interface TableNode {
  type: "table";
  id: NodeId;
  columns: TableColumn[];
  rows: TableRow[];
  style?: TableStyle;
  repeat?: {
    path: string;
    alias: string;
    templateRowId: string;
    emptyFallback?: boolean;
  };
}

export interface ImageBlockNode {
  type: "image";
  id: NodeId;
  assetId: AssetId;
  alt?: string;
  title?: string;
  widthUm?: number;
  heightUm?: number;
}

export interface PageBreakNode {
  type: "page-break";
  id: NodeId;
}

export interface HorizontalRuleNode {
  type: "horizontal-rule";
  id: NodeId;
}

/**
 * Block-level LaTeX equation — display mode centered.
 * Simple subset only; complex macros are out of scope for v1 (see roadmap 2.2).
 */
export interface EquationBlockNode {
  type: "equation-block";
  id: NodeId;
  latex: string;
  label?: string;
}

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | QuoteNode
  | ListNode
  | TableNode
  | ImageBlockNode
  | PageBreakNode
  | HorizontalRuleNode
  | EquationBlockNode;

export interface RootNode {
  type: "root";
  id: NodeId;
  children: BlockNode[];
}

// ── Assets ─────────────────────────────────────────────────────────
export interface AssetVariant {
  storageKey: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
}

export interface AssetRef {
  id: AssetId;
  kind: "image";
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
  storageKey: string;
  sha256: string; // hex 64
  byteLength: number;
  widthPx?: number;
  heightPx?: number;
  alt: string;
  title?: string;
  variants?: Record<string, AssetVariant>;
}

// ── Document envelope ────────────────────────────────────────────
export interface PortableDocument {
  schema: typeof SCHEMA_TYPE;
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  revision: number;
  locale: string;
  direction: "ltr" | "rtl" | "auto";
  createdAt: string; // ISO8601 UTC
  updatedAt: string;
  metadata: Record<string, JsonValue>;
  page: PageSettings;
  root: RootNode;
  assets: Record<string, AssetRef>;
  variableSchema?: Record<string, JsonValue>;
  extensions?: Record<string, JsonValue>;
}

// ── Selection ────────────────────────────────────────────────
export interface Point {
  nodeId: NodeId;
  offset: number;
  affinity: "forward" | "backward";
}

export interface RangeSelection {
  kind: "range";
  anchor: Point;
  focus: Point;
}

export type Selection = RangeSelection | { kind: "none" } | { kind: "node"; nodeId: NodeId };

// ── Platform ports (Phase 3.1) — no direct window/document/fs access in core ──
export interface BinarySink {
  write(chunk: Uint8Array): Promise<void> | void;
  close(): Promise<void> | void;
}

export interface ResolvedAsset {
  id: string;
  mediaType: string;
  data: Uint8Array;
  widthPx?: number;
  heightPx?: number;
}

export interface AssetResolver {
  resolve(assetId: string, variant?: string): Promise<ResolvedAsset>;
}

export interface Clock {
  nowIso(): string;
}

export interface IdGenerator {
  next(): string;
}
