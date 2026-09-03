import type { AssetId, NodeId, TextMarks } from "./primitives.js";

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

export interface InlineEquationNode {
  type: "equation";
  id: NodeId;
  latex: string;
  display?: boolean;
}

export interface FootnoteRefInline {
  type: "footnote-ref";
  id: NodeId;
  footnoteId: string;
  customMark?: string;
}

export type FootnoteRefInlineNode = FootnoteRefInline;

export type InlineNode =
  | TextNode
  | VariableNode
  | LinkNode
  | InlineImageNode
  | HardBreakNode
  | InlineEquationNode
  | FootnoteRefInline;
