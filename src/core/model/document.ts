import type { AssetId, JsonValue, PageMarginsUm, NodeId } from "./primitives.js";
import { SCHEMA_TYPE, SCHEMA_VERSION } from "./primitives.js";
import type { RootNode } from "./block.js";
import type { InlineNode } from "./inline.js";

export interface HeaderFooterZone {
  left?: InlineNode[];
  center?: InlineNode[];
  right?: InlineNode[];
}

export interface HeaderFooterConfig {
  header?: HeaderFooterZone;
  footer?: HeaderFooterZone;
  firstPageDifferent?: boolean;
  firstPageHeader?: HeaderFooterZone;
  firstPageFooter?: HeaderFooterZone;
  oddEvenDifferent?: boolean;
  evenPageHeader?: HeaderFooterZone;
  evenPageFooter?: HeaderFooterZone;
  headerDistanceUm?: number; // Distance from page top edge, default: 12700 (0.5 in)
  footerDistanceUm?: number; // Distance from page bottom edge, default: 12700 (0.5 in)
}

export interface PageSettings {
  widthUm: number;
  heightUm: number;
  marginUm: PageMarginsUm;
  orientation?: "portrait" | "landscape";
  headerFooter?: HeaderFooterConfig;
}

export type DocumentPageSettings = PageSettings;

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
  sha256: string;
  byteLength: number;
  widthPx?: number;
  heightPx?: number;
  alt: string;
  title?: string;
  variants?: Record<string, AssetVariant>;
}

export interface PortableDocument {
  schema: typeof SCHEMA_TYPE;
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  revision: number;
  locale: string;
  direction: "ltr" | "rtl" | "auto";
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, JsonValue>;
  page: PageSettings;
  root: RootNode;
  assets: Record<string, AssetRef>;
  variableSchema?: Record<string, JsonValue>;
  extensions?: Record<string, JsonValue>;
}

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
