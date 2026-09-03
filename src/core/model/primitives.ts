export const SCHEMA_VERSION = 1 as const;
export const SCHEMA_TYPE = "portable-doc" as const;

export type NodeId = string;
export type AssetId = string;
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface PageMarginsUm {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TextMarks {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  color?: string;
  background?: string;
  fontSizePt?: number;
  fontFamily?: string;
}

export interface Clock {
  nowIso(): string;
}

export interface IdGenerator {
  next(): string;
}
