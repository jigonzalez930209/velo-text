import {
  SCHEMA_VERSION,
  type PortableDocument,
  type RootNode,
  type ParagraphNode,
  type HeadingNode,
  type TextNode,
  type VariableNode,
  type ImageBlockNode,
  type TableNode,
  type InlineEquationNode,
  type EquationBlockNode,
  type ColumnsNode,
  type IdGenerator,
  type Clock,
} from "./types.js";

export function createIdGenerator(prefix = "n"): IdGenerator {
  let c = 0;
  return { next: (): string => `${prefix}_${(++c).toString(36).padStart(6, "0")}` };
}

export function createSystemClock(): Clock {
  return { nowIso: () => new Date().toISOString() };
}

export interface CreateDocumentOptions {
  id?: string;
  locale?: string;
  direction?: PortableDocument["direction"];
  createdAt?: string;
  updatedAt?: string;
  metadata?: PortableDocument["metadata"];
  page?: PortableDocument["page"];
  root?: RootNode;
  assets?: PortableDocument["assets"];
  extensions?: PortableDocument["extensions"];
  idGenerator?: IdGenerator;
  clock?: Clock;
}

export function createDocument(opts: CreateDocumentOptions = {}): PortableDocument {
  const idGen: IdGenerator = opts.idGenerator ?? createIdGenerator("doc");
  const clock: Clock = opts.clock ?? createSystemClock();
  const now = clock.nowIso();
  const docId = opts.id ?? idGen.next();
  return {
    schema: "portable-doc",
    schemaVersion: SCHEMA_VERSION,
    id: docId,
    revision: 0,
    locale: opts.locale ?? "es-AR",
    direction: opts.direction ?? "ltr",
    createdAt: opts.createdAt ?? now,
    updatedAt: opts.updatedAt ?? now,
    metadata: opts.metadata ?? {},
    page: opts.page ?? {
      widthUm: 210_000, // A4 210mm
      heightUm: 297_000,
      marginUm: { top: 20_000, right: 20_000, bottom: 20_000, left: 20_000 },
    },
    root: opts.root ?? { type: "root", id: idGen.next(), children: [] },
    assets: opts.assets ?? {},
    extensions: opts.extensions,
  };
}

export function createParagraph(idGen: IdGenerator, children: ParagraphNode["children"] = [], extra: Partial<Omit<ParagraphNode, "type" | "id" | "children">> = {}): ParagraphNode {
  return { type: "paragraph", id: idGen.next(), children, ...extra };
}

export function createHeading(idGen: IdGenerator, level: HeadingNode["level"], children: HeadingNode["children"] = []): HeadingNode {
  return { type: "heading", id: idGen.next(), level, children };
}

export function createText(idGen: IdGenerator, text: string, marks?: TextNode["marks"]): TextNode {
  const n: TextNode = { type: "text", id: idGen.next(), text };
  if (marks) n.marks = marks;
  return n;
}

export function createVariable(
  idGen: IdGenerator,
  path: string,
  source?: string,
  extra: Partial<Pick<VariableNode, "valueType" | "format" | "fallback" | "marks">> = {},
): VariableNode {
  return {
    type: "variable",
    id: idGen.next(),
    path,
    source: source ?? `{{${path}}}`,
    valueType: extra.valueType ?? "unknown",
    ...(extra.format !== undefined ? { format: extra.format } : {}),
    ...(extra.fallback !== undefined ? { fallback: extra.fallback } : {}),
    ...(extra.marks !== undefined ? { marks: extra.marks } : {}),
  };
}

export function createImageBlock(idGen: IdGenerator, assetId: string, extra: Partial<Omit<ImageBlockNode, "type" | "id" | "assetId">> = {}): ImageBlockNode {
  return { type: "image", id: idGen.next(), assetId, ...extra };
}

export function createTable(idGen: IdGenerator, cols = 2, rows = 2): TableNode {
  const columns = Array.from({ length: cols }, () => ({ id: idGen.next(), widthUm: 40_000 }));
  const tableRows = Array.from({ length: rows }, () => ({
    id: idGen.next(),
    cells: Array.from({ length: cols }, () => ({
      id: idGen.next(),
      colSpan: 1,
      rowSpan: 1,
      blocks: [
        {
          type: "paragraph",
          id: idGen.next(),
          children: [{ type: "text", id: idGen.next(), text: "" }],
        } as ParagraphNode,
      ],
    })),
  }));
  return { type: "table", id: idGen.next(), columns, rows: tableRows };
}

/**
 * Create an inline LaTeX equation node.
 * Validation of the LaTeX subset is deferred to the validator; this factory only ensures required fields.
 */
export function createEquation(idGen: IdGenerator, latex: string, display = false): InlineEquationNode {
  return { type: "equation", id: idGen.next(), latex, ...(display ? { display: true as const } : {}) };
}

/**
 * Create a block-level display equation.
 */
export function createEquationBlock(idGen: IdGenerator, latex: string, label?: string): EquationBlockNode {
  return { type: "equation-block", id: idGen.next(), latex, ...(label ? { label } : {}) };
}

export function createColumns(idGen: IdGenerator, countOrPcts: number | number[] = 2): ColumnsNode {
  let pcts: number[];
  if (Array.isArray(countOrPcts)) {
    pcts = countOrPcts.filter((n) => n > 0);
    if (pcts.length < 2) pcts = [50, 50];
  } else {
    const n = Math.max(2, Math.min(4, countOrPcts));
    const even = Math.floor(100 / n);
    pcts = Array.from({ length: n }, (_, i) => (i === n - 1 ? 100 - even * (n - 1) : even));
  }
  return {
    type: "columns",
    id: idGen.next(),
    columns: pcts.map((widthPct) => ({
      id: idGen.next(),
      widthPct,
      blocks: [{ type: "paragraph" as const, id: idGen.next(), children: [{ type: "text" as const, id: idGen.next(), text: "" }] }],
    })),
  };
}
