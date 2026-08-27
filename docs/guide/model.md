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
- **Block**: `paragraph`, `heading` (1-6), `quote`, `list` (ordered/unordered), `table`, `image`, `page-break`, `horizontal-rule`, `equation-block`.
- **Inline**: `text` (+`marks`), `variable` (atomic), `link`, `inline-image`, `hard-break`, `equation` (inline).

Variable example:
```ts
{ type: "variable", id: "v1", path: "customer.address.city", source: "{{customer.address.city}}", valueType: "string" }
```
User writes `&#123;&#123;name&#125;&#125;` but parser produces `VariableNode` with `contenteditable=false`.

## Tables
```ts
interface TableNode { columns: TableColumn[]; rows: TableRow[]; repeat?: { path, alias, templateRowId } }
interface TableCell { colSpan, rowSpan, blocks: BlockNode[] }
```
Repeat row clones `templateRowId` for each `alias` in collection `path` (see template engine).

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

See `src/core/model/types.ts`, `factories.ts`, `src/core/schema/validator.ts`, `canonical.ts`, `src/core/normalize/normalize.ts`.
