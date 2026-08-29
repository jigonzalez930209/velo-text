# Model, schema, ops, equations

## Envelope

```ts
interface PortableDocument {
  schema: "portable-doc";
  schemaVersion: 1;
  id: string; revision: number;
  locale: string; direction: "ltr" | "rtl" | "auto";
  createdAt: string; updatedAt: string; // ISO8601 UTC
  metadata: Record<string, JsonValue>;
  page: { widthUm: number; heightUm: number; marginUm: { top; right; bottom; left } };
  root: RootNode;
  assets: Record<string, AssetRef>;
  variableSchema?: VariableSchema;
  extensions?: unknown;
}
```

Units are **integer micrometers**. Colors `#RRGGBBAA`. IDs unique and opaque. Array order is significant (Postgres `jsonb` does not keep object key order).

Default page: A4 `210_000 × 297_000` µm, margins `20_000`. Default locale: `es-AR`.

## Blocks and inlines

**Blocks:** `paragraph` (`align?`: left/center/right/justify), `heading` (1–6), `quote`, `list` (ordered/unordered), `table`, `columns`, `image` (`align?`: left/center/right, `widthUm`/`heightUm`, `assetId`, `alt?`), `page-break`, `horizontal-rule`, `equation-block`.

**Inlines:** `text` (+ `marks`), `variable` (atomic), `link`, `inline-image`, `hard-break`, `equation`.

```ts
{ type: "variable", id, path: "customer.city", source: "{{customer.city}}", valueType: "string" }
```

**Table:** `columns[]` (`widthUm`), `rows[]` (`header?`, `heightUm?`, `cells[]` with `colSpan`/`rowSpan`/`blocks[]`). Optional `repeat: { path, alias, templateRowId }`.

**Columns:** `columns[]` slots (`blocks[]`, `widthPct?`), `gapUm?`. Factory `createColumns(idGen, count | pcts)`.

## Factories (`velo-text` / `velo-text/core`)

Inject `IdGenerator` and `Clock` (tests use a fixed clock).

- `createIdGenerator(prefix?)` — ids like `prefix_000001`
- `createSystemClock()`
- `createDocument({ idGenerator, clock, locale, page, ... })`
- `createParagraph`, `createHeading(level)`, `createText(text, marks?)`, `createVariable`, `createImageBlock`, `createTable(rows, cols)`, `createEquation` / `createEquationBlock`, `createColumns`

## Validate / canonicalize / normalize

- `validateDocument(doc, { strict, maxErrors })` → `{ valid, errors: { path, code, severity }[] }` JSON Pointer. Duplicate ids, table spans, LaTeX.
- `assertValid(doc)`
- `canonicalStringify` (sorted keys), `canonicalBytes`, `contentHashHex` (sha256)
- `normalizeDocument`, `isIdempotent` — merge adjacent texts, table repair
- Schema file: `schemas/portable-doc-v1.json`

## Operations and history

- `createTransaction(doc, intent)` — `insertBlock`/`deleteBlock`, `insertInline`/`deleteInline`, `applyMarks`, `commit()` → `{ document, ops, inverses, intent }`
- Selection (not persisted): `createCollapsedSelection`, `createRangeSelection`, `isCollapsed`, `mapSelectionThroughOps`
- `History` — snapshots + ops/inverses, typing coalesce, stack limit; editor undo uses this

## Equations

Subset only: `\frac`, `\sqrt`, `^`/`_`, greek. `MAX_LATEX_LENGTH = 2000`. Block `\input`, `\def`; braces must balance.

- `validateLatex` → `{ valid, errors }`
- `latexToHtml` (frac/sqrt spans), `latexToPlainText` (PDF fallback `$latex$`)
- `equationCss`
- Nodes: `type: "equation"` inline (`display?`), `type: "equation-block"`
