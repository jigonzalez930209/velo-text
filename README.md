# velo-text

Portable document editor with variables `{{name}}`, tables, images, LaTeX equations and deterministic export to **PDF, ODT, and DOCX** — **zero runtime dependencies**, TypeScript strict. LibreOffice/Word CI and full visual parity across Office formats are still open.

> Roadmap: `roadmap_editor_documental_portable.md` — implementation follows Phase 0–12 depth 3.

## Install

```bash
pnpm add velo-text
# or local
pnpm install
pnpm run build
```

Requires Node >=18. Uses `pnpm` exclusively (see `packageManager`).

## Quick start

```ts
import { createDocument, createIdGenerator, exportDocument } from "velo-text";
import { createBufferSink } from "velo-text/backend";

const doc = createDocument({ idGenerator: createIdGenerator("doc"), clock: { nowIso: () => new Date().toISOString() } });
doc.root.children.push(
  { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "Hello " }, { type: "variable", id: "v1", path: "name", source: "{{name}}", valueType: "string" }] },
  { type: "equation-block", id: "eq1", latex: "\\frac{a}{b}" },
);

const { sink, getBuffer } = createBufferSink();
await exportDocument({
  document: doc,
  data: { name: "World" },
  format: "pdf",
  sink,
  options: { deterministic: true, strict: false },
});
const pdfBytes = getBuffer(); // Uint8Array
```

## Browser (vanilla)

```html
<link rel="stylesheet" href="themes/base.css">
<link rel="stylesheet" href="themes/components.css">
<div id="editor" class="pde-root" data-pde-theme="light-neutral" contenteditable="true"></div>
<script type="module">
  import { renderDocumentToHtml, getIconSvg } from "./dist/public-api/index.js";
  document.getElementById("editor").innerHTML = renderDocumentToHtml(doc);
  document.getElementById("toolbar").innerHTML = getIconSvg("bold", { color: "var(--pde-color-primary)" });
</script>
```

See `examples/` (vanilla, React, Vue, Svelte, Angular, Astro), `examples/backend.mjs`, `examples/postgres.mjs`, `examples/s3.mjs`. Interactive playground: `pnpm docs:dev` → `/playground/`.

## Features

| Area | Status |
|---|---|
| Core model, validator, canonical hash, normalize, operations, history | ✅ `src/core` |
| Variables `{{path}}`, `\| format`, `?? fallback`, repeat rows | ✅ `src/template` |
| LaTeX simple (`\frac`, `\sqrt`, `^/_`, greek) inline/block | ✅ `src/core/equation` |
| SVG icons (28) with `currentColor` → recolorable via CSS | ✅ `src/assets/icons` |
| Web editor: `createEditor`, cell typing/align, image align L/C/R, col/row resize, columns, IME, clipboard allowlist, a11y | ✅ `src/editor-web` |
| Assets: sniff (PNG/JPEG/WebP/SVG), dimensions, SHA-256, store dedupe & GC | ✅ `src/assets` |
| S3 presigned URLs SigV4, PG jsonb + revisions + optimistic concurrency | ✅ `src/adapters` |
| Layout: units (µm/pt/twip/EMU), text line break, pagination widows/orphans | ✅ `src/export/layout` |
| Export: PDF / ODT / DOCX (`exportDocument`); PDF has xref, table grid, image align, PNG downscale | ✅ `src/export` |
| Themes: `light-neutral`, `light-warm`, `dark-slate`, `dark-contrast` + CSS tokens | ✅ `themes/` |

## Scripts

```bash
pnpm run check:types      # tsc strict
pnpm run check:zero-deps  # 0 runtime deps
pnpm run check:circular   # no circular imports, core isolation
pnpm run check:fixtures   # 33 fixtures validate
pnpm run check:smoke      # PDF/ODT/DOCX magic + deterministic clock
pnpm run soak             # repeated export (SOAK_ITERS)
pnpm run test             # unit + conformance + integration + security
pnpm run test:security    # XSS / prototype / SVG / LaTeX corpus
pnpm run test:visual      # HTML snapshots in tests/visual/snapshots
pnpm run fuzz -- --iterations=5000
pnpm run build            # tsc → dist/
pnpm docs:dev             # VitePress docs + playground at /playground/
```

## Zero dependencies

```json
// package.json
"dependencies": {} // 0
"devDependencies": { "typescript": "5.6.3", "@types/node": "^26.3.0" }
```

Verified via `scripts/check-zero-deps.js` and CI.

## Themes

All colors/sizes via CSS variables (`--pde-*`), no hard-coded literals outside `themes/`. Override any token:

```css
.pde-root { --pde-color-primary: #ff0000; --pde-icon-color: currentColor; }
```

## License

MIT — `LICENSE`.
