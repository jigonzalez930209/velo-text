import type { PortableDocument, IdGenerator, Clock, TextMarks } from "../../core/model/types.js";
import type { ThemeName } from "../../theme/index.js";

export interface EditorOptions {
  document: PortableDocument;
  theme?: ThemeName;
  editable?: boolean;
  idGenerator?: IdGenerator;
  clock?: Clock;
  onChange?: (doc: PortableDocument) => void;
  resolveAssetUrl?: (assetId: string) => string | undefined;
  onImageFile?: (file: File) => Promise<{ assetId: string; error?: string; widthUm?: number; heightUm?: number }>;
  getVariableCatalog?: () => string[];
  getTemplateData?: () => Record<string, unknown>;
}

export type InsertBlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "quote"
  | "listUnordered"
  | "listOrdered"
  | "table"
  | "equationBlock"
  | "pageBreak"
  | "horizontalRule"
  | "columns";

export interface Editor {
  getDocument(): PortableDocument;
  setDocument(doc: PortableDocument): void;
  setTheme(theme: ThemeName): void;
  getTheme(): ThemeName;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  commands: {
    toggleMark(mark: keyof TextMarks & string): void;
    setHeading(level: number | null): void;
    toggleList(kind: "ordered" | "unordered"): void;
    toggleQuote(): void;
    setAlign(align: "left" | "center" | "right" | "justify"): void;
    clearFormat(): void;
    insertVariable(path: string, format?: string, fallback?: string): void;
    insertEquation(latex: string, display?: boolean): void;
    insertImage(assetId: string, widthUm?: number, heightUm?: number): void;
    insertTable(rows: number, cols: number): void;
    insertColumns(countOrPcts?: number | number[]): void;
    insertColumnMosaic(counts: number[]): void;
    insertBlock(type: InsertBlockType): void;
    deleteCurrentBlock(): void;
    setColor(color: string): void;
    setHighlight(color: string): void;
    setFontFamily(family: string, saved?: { blockId: string; start: number; end: number } | null): void;
    setFontSizePt(pt: number, saved?: { blockId: string; start: number; end: number } | null): void;
    indent(delta?: number): void;
    insertLink(href: string): void;
  };
  openCommandPalette(): void;
  openFind(replace?: boolean): void;
  openShortcuts(): void;
  openEquationEditor(opts?: { latex?: string; display?: boolean }): void;
  setPagePreview(on: boolean): void;
  getOutline(): Array<{ id: string; level: 1 | 2 | 3; text: string }>;
  focusBlock(id: string): boolean;
  captureTextSelection(): { blockId: string; start: number; end: number } | null;
  destroy(): void;
}

export const BLOCK_SEL =
  'p, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, table, figure, hr, [data-node-type="page-break"], [data-node-type="equation-block"], [data-node-type="columns"]';

export const MAX_HISTORY = 100;
export const COALESCE_MS = 800;

export interface EditorState {
  container: HTMLElement;
  wrapper: HTMLElement;
  ui: HTMLElement;
  ownerDoc: Document;
  opts: EditorOptions;
  idGen: IdGenerator;
  cleanup: Array<() => void>;
  lastChangeTime: number;
  suppress: boolean;
  destroyed: boolean;
  theme: ThemeName;
  getDoc: () => PortableDocument;
  setDoc: (d: PortableDocument) => void;
  render: () => void;
  pushSnapshot: () => void;
  syncFromDom: (coalesce?: boolean) => void;
  addBoth: (type: string, fn: (e: Event) => void) => void;
  selection: () => Selection | null;
  currentBlockEl: () => HTMLElement | null;
  blockElements: () => HTMLElement[];
  indexOfBlockEl: (el: HTMLElement) => number;
  blockIdOf: (el: HTMLElement) => string;
}
