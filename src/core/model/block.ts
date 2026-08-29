import type { AssetId, JsonValue, NodeId } from "./primitives.js";
import type { InlineNode } from "./inline.js";

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
  heightUm?: number;
}

export interface TableLook {
  headerRow?: boolean;
  totalRow?: boolean;
  bandedRows?: boolean;
  firstColumn?: boolean;
  lastColumn?: boolean;
  bandedColumns?: boolean;
}

export type TableDensity = "compact" | "normal" | "large";
export type TablePreset = "plain" | "grid" | "grid-banded" | "list" | "list-header" | "accent";

export interface TableStyle {
  border?: string;
  width?: string;
  density?: TableDensity;
  preset?: TablePreset;
  look?: TableLook;
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
  align?: "left" | "center" | "right";
}

export interface PageBreakNode {
  type: "page-break";
  id: NodeId;
}

export interface HorizontalRuleNode {
  type: "horizontal-rule";
  id: NodeId;
}

export interface EquationBlockNode {
  type: "equation-block";
  id: NodeId;
  latex: string;
  label?: string;
}

export interface ColumnSlot {
  id: NodeId;
  blocks: BlockNode[];
  widthPct?: number;
  vAlign?: "top" | "middle" | "bottom";
}

export interface ColumnsNode {
  type: "columns";
  id: NodeId;
  columns: ColumnSlot[];
  gapUm?: number;
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
  | EquationBlockNode
  | ColumnsNode;

export interface RootNode {
  type: "root";
  id: NodeId;
  children: BlockNode[];
}
