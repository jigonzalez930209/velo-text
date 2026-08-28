# Architecture

## Five layers
1. **Core** — pure, no `window`/`document`/`fs`. Receives capabilities via ports: `BinarySink`, `AssetResolver`, `Clock`, `IdGenerator`.
2. **Editor Web** — `contenteditable` host, toolbar, overlays, sanitized paste, shortcut pipeline, themes.
3. **Template engine** — scalar vars, paths, formatted values, row repeat.
4. **Exporters** — `exportDocument` for PDF, ODT, and DOCX (Office visual parity vs PDF is still partial).
5. **Adapters** — ports only (PG contract + SQL, S3 SigV4). Host apps supply the real client.

```ts
// Ports (src/core/model/types.ts)
export interface BinarySink { write(chunk: Uint8Array): Promise<void>|void; close(): Promise<void>|void; }
export interface AssetResolver { resolve(assetId: string, variant?: string): Promise<ResolvedAsset>; }
export interface Clock { nowIso(): string; }
export interface IdGenerator { next(): string; }
```

## Canonical & immutable
Every transaction in `src/core/operations` starts from a valid snapshot. The web host undo stack is `History` with document snapshots (not inverse ops).

## Adapters
`postgres-contract` and `s3-compatible` are **ports**: in-memory repo + SQL (`migrations/001_init.sql`) and SigV4 helpers. They are not a `pg` driver or an S3 SDK. Host apps inject a real client.

## Ops and DOM
DOM is the live typing surface. Shortcuts and paste are intercepted; other input syncs AST via `domToAst`. `History` stores snapshots for undo. Full intent→operation for every keystroke is not wired (would need caret mapping first).

## Capabilities
Each module declares needed capabilities (e.g. PDF writer needs `BinarySink`, `Clock`, optional asset bytes), making it testable and free of hidden deps.

## Security by default
- No pasted HTML execution, no `javascript:` URLs, no prototype pollution, magic-signature image check, XML/PDF escaping.
- Isolated core (`pnpm run lint` fails if `window`/`document` appears in `src/core`).

## Source file size
Each **source** file (`src/**/*.ts`, `themes/*.css`, `tests/unit/*.js`, `schemas/portable-doc-v1.json`) stays at **≤ 250 lines**. Large JSON fixtures (`tests/fixtures/22-large.json`, `23-big-table.json`) are data, not split.

## Repo structure
See `src/` — `core/model|operations|selection|history|normalize|schema|events`, `template/parser|resolver`, `editor-web/controller|view|input|clipboard|toolbar|tables|images|accessibility`, `export/layout|pdf|odt|docx|xml|zip`, `assets/sniff|dimensions|svg|hashing|icons|store`, `adapters/browser|backend|postgres-contract|s3-compatible`, `theme`, `public-api`.
