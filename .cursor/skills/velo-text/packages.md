# Package entry points

From `package.json` `exports`. Prefer a **subpath** so the host does not pull unused layers.

| Import | Use |
| --- | --- |
| `velo-text` | Public barrel (`src/public-api`): factories, editor, export, plugins. Fine for small apps. |
| `velo-text/core` | Model, schema, normalize, ops, history, equation — no editor, no writers. |
| `velo-text/template` | Parser, `safeResolve`, `renderTemplate`, formatters. |
| `velo-text/editor-web` | `createEditor`, view, UX. Client only. |
| `velo-text/vanilla` | `mountVanillaEditor` only. |
| `velo-text/export` | `exportDocument`, `exportPdf`, `previewPdf`, writers, layout. |
| `velo-text/backend` | `createBufferSink`, `createFileSink`, `handlePdfExportJson`, Express/Vercel/Vite PDF helpers. Node. |
| `velo-text/api-report` | `reportSlots`, `dataFromSlotValues`, `assetsFromSlotValues`. No editor, no writers. |
| `velo-text/themes/*` | CSS files (`base.css`, `components.css`). |

CSS side effects: `import "velo-text/themes/base.css"` and `import "velo-text/themes/components.css"`.

Ports (types on the document / export request):

```ts
interface BinarySink { write(chunk: Uint8Array): void | Promise<void>; close(): void | Promise<void> }
interface AssetResolver { resolve(assetId: string, variant?: string): Promise<ResolvedAsset> }
interface Clock { nowIso(): string }
interface IdGenerator { next(): string }
```

Published `dependencies` must stay `{}`. Frameworks, `pg`, and AWS clients live in the **app**.
