# Architecture

velo-text is five layers. The **document is JSON**. HTML is a view. PDF/ODT/DOCX are derived.

```
PortableDocument (AST)
  ├─ Core        model, ops, history, schema, normalize
  ├─ Template    parser, resolver, formatters, repeat rows
  ├─ Editor web  view, input, tables, clipboard, UX chrome
  ├─ Assets      sniff, dimensions, hash, store, S3 port
  ├─ Layout      µm, line break, pagination
  ├─ Export      pdf, odt, docx
  ├─ Theme       CSS tokens, 4 presets
  ├─ Adapters    browser, backend, PG contract, S3 SigV4
  └─ api-report  optional slot map (no editor, no writers)
```

## Layers

1. **Core** — no `window`, `document`, or `fs`. Capabilities arrive as ports.
2. **Editor web** — `contenteditable` host, toolbar, overlays, sanitized paste, shortcuts, themes.
3. **Template engine** — scalar vars, paths, formatted values, row repeat.
4. **Exporters** — `exportDocument({ format: "pdf" | "odt" | "docx" })`. PDF layout is ahead of Office visual parity.
5. **Adapters** — ports only. Hosts inject `pg`, S3, or blobs.

```ts
export interface BinarySink {
  write(chunk: Uint8Array): Promise<void> | void;
  close(): Promise<void> | void;
}
export interface AssetResolver {
  resolve(assetId: string, variant?: string): Promise<ResolvedAsset>;
}
export interface Clock {
  nowIso(): string;
}
export interface IdGenerator {
  next(): string;
}
```

Same export logic with a `Blob` in the browser, a buffer in tests, or a stream on Node.

## Canonical and immutable

Transactions in `src/core/operations` start from a valid snapshot. Editor undo uses `History`: each entry stores a **document snapshot** plus ops/inverses, with typing coalesced.

## DOM vs AST

The DOM is the typing surface. Shortcuts and paste are intercepted; other input syncs via `domToAst` → `normalizeDocument`. There is no intent→operation for every key (that needs a full caret map first).

## Invariants

| Rule | Check |
| --- | --- |
| No DOM/fs in core | `pnpm run lint` |
| No runtime npm deps | `pnpm run check:zero-deps` |
| Source file ≤ 250 lines | `src/**/*.ts`, `themes/*.css`, unit tests, JSON schema |
| Security defaults | paste allowlist, no `javascript:`, magic-byte images, escaped XML/PDF |

Large fixtures (`tests/fixtures/22-*.json`) are data, not split.

## Where code lives

| Path | Role |
| --- | --- |
| `src/core/` | model, operations, selection, history, normalize, schema, events, equation, plugin |
| `src/template/` | parser, resolver, formatters |
| `src/editor-web/` | controller, view, input, clipboard, toolbar, tables, images, accessibility, ux |
| `src/export/` | layout, pdf, odt, docx, xml, zip, images |
| `src/assets/` | sniff, dimensions, svg, hashing, icons, store |
| `src/adapters/` | browser, backend, postgres-contract, s3-compatible |
| `src/theme/` | presets |
| `src/public-api/` | npm barrel (editor + export — prefer subpaths in apps) |
| `src/api-report/` | optional slot map for backend fill (`velo-text/api-report`) |

Continue with the [data model](/guide/model) or [editor](/guide/editor).
