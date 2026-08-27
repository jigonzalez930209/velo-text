# Architecture

## Five layers
1. **Core** — pure, no `window`/`document`/`fs`. Receives capabilities via ports: `BinarySink`, `AssetResolver`, `Clock`, `IdGenerator`.
2. **Editor Web** — `contenteditable` host, toolbar, selection, clipboard, DnD, themes.
3. **Template engine** — scalar vars, paths, formatted values, row repeat.
4. **Exporters** — PDF, DOCX, ODT implemented inside the project (`XmlWriter`, `ZipWriter`, `PdfWriter`...).
5. **Adapters** — PG `jsonb`, S3-compatible storage, browser/backend, fs.

```ts
// Ports (src/core/model/types.ts)
export interface BinarySink { write(chunk: Uint8Array): Promise<void>|void; close(): Promise<void>|void; }
export interface AssetResolver { resolve(assetId: string, variant?: string): Promise<ResolvedAsset>; }
export interface Clock { nowIso(): string; }
export interface IdGenerator { next(): string; }
```

## Canonical & immutable
Every transaction starts from a valid snapshot and produces another. No direct mutations are exposed. Undo/redo via inverse ops.

## Ops before DOM
DOM reflects state. `beforeinput` → intent → operation → AST → normalize → reconcile → restore selection → emit `change`.

## Capabilities
Each module declares needed capabilities (e.g. DOCX exporter needs `AssetResolver, ZipWriter, XmlWriter, Clock`), making it testable and free of hidden deps.

## Security by default
- No pasted HTML execution, no `javascript:` URLs, no prototype pollution, magic-signature image check, XML/PDF escaping.
- Isolated core (`pnpm run lint` fails if `window`/`document` appears in `src/core`).

## Source file size
Each **source** file (`src/**/*.ts`, `themes/*.css`, `tests/unit/*.js`, `schemas/portable-doc-v1.json`) stays at **≤ 250 lines**. Large JSON fixtures (`tests/fixtures/22-large.json`, `23-big-table.json`) are data, not split.

## Repo structure
See `src/` — `core/model|operations|selection|history|normalize|schema|events`, `template/parser|resolver`, `editor-web/controller|view|input|clipboard|toolbar|tables|images|accessibility`, `export/layout|pdf|odt|docx|xml|zip`, `assets/sniff|dimensions|svg|hashing|icons|store`, `adapters/browser|backend|postgres-contract|s3-compatible`, `theme`, `public-api`.
