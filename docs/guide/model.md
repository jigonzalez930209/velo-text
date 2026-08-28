# Data Model

## Envelope
```ts
interface PortableDocument {
  schema: "portable-doc";
  schemaVersion: 1;
  id: string; revision: number;
  locale: string; direction: "ltr"|"rtl"|"auto";
  createdAt: string; updatedAt: string; // ISO8601 UTC
  metadata: Record<string, JsonValue>;
  page: PageSettings; // widthUm, heightUm, marginUm in micrometers (int)
  root: RootNode;
  assets: Record<string, AssetRef>;
  variableSchema?: VariableSchema;
}
```
- Arrays preserve order (important for `jsonb` — PG does not preserve key order).
- Colors as `#RRGGBBAA`, IDs opaque & unique, dates UTC.

## Nodes
- **Block**: `paragraph` (optional `align`: left/center/right/justify), `heading` (1-6), `quote`, `list` (ordered/unordered), `table`, `columns`, `image` (optional `align`: left/center/right, `widthUm`/`heightUm`), `page-break`, `horizontal-rule`, `equation-block`.
- **Inline**: `text` (+`marks`), `variable` (atomic), `link`, `inline-image`, `hard-break`, `equation` (inline).

Variable example:
```ts
{ type: "variable", id: "v1", path: "customer.address.city", source: "{{customer.address.city}}", valueType: "string" }
```
User writes `&#123;&#123;name&#125;&#125;` but parser produces `VariableNode` with `contenteditable=false`.

## Tables
```ts
interface TableNode { columns: TableColumn[]; rows: TableRow[]; repeat?: { path, alias, templateRowId } }
interface TableColumn { id: string; widthUm: number }
interface TableRow { id: NodeId; cells: TableCell[]; header?: boolean; heightUm?: number }
interface TableCell { colSpan, rowSpan, blocks: BlockNode[] }
```
Cell `blocks` are nested documents (usually a `paragraph`). Repeat row clones `templateRowId` for each `alias` in collection `path` (see template engine).

## Columns
```ts
interface ColumnsNode { type: "columns"; id: NodeId; columns: ColumnSlot[]; gapUm?: number }
interface ColumnSlot { id: NodeId; blocks: BlockNode[]; widthPct?: number }
```
Factory: `createColumns(idGen, count)`.

## Images
```ts
interface ImageBlockNode {
  type: "image";
  id: NodeId;
  assetId: AssetId;
  alt?: string;
  widthUm?: number;
  heightUm?: number;
  align?: "left" | "center" | "right";
}
```
Display size is µm. PDF export downscales **PNG** pixels when that size is smaller than the source (see [Export](/guide/export)).

## Assets
```ts
interface AssetRef {
  id: string; kind: "image";
  mediaType: "image/png"|"image/jpeg"|"image/webp"|"image/svg+xml";
  storageKey: string; sha256: string; byteLength: number;
  widthPx?: number; heightPx?: number; alt: string;
  variants?: Record<string, AssetVariant>;
}
```
URLs are not stored — only `storageKey` + `sha256`. Signed URLs are ephemeral.

## Selection & History
Selection is ephemeral (`RangeSelection { anchor, focus: Point { nodeId, offset, affinity } }`), not persisted. History stores inverse ops grouped by intent, with coalescing and checkpoints.

## Validation
`validateDocument(doc, {strict})` returns `{valid, errors: {path, code, severity}[]}` with JSON Pointer. Migrations are sequential `v1→v2`.

See `src/core/model/types.ts` (re-exports `primitives`, `inline`, `block`, `document`), `factories.ts`, `src/core/schema/validator.ts`, `canonical.ts`, `src/core/normalize/normalize.ts`.
