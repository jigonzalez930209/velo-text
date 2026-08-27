export interface PageBox {
  id: string;
  type: string;
  xUm: number;
  yUm: number;
  widthUm: number;
  heightUm: number;
  content?: string;
  lines?: Array<{ text: string; yUm: number }>;
}

export interface LayoutPage {
  index: number;
  widthUm: number;
  heightUm: number;
  usableWidthUm: number;
  usableHeightUm: number;
  boxes: PageBox[];
}

export interface PaginationOptions {
  widows?: number;
  orphans?: number;
}

export interface PaginationResult {
  pages: LayoutPage[];
  diagnostics: Array<{ code: string; message: string; severity: "warn" | "error" | "info" }>;
  hash: string;
}
