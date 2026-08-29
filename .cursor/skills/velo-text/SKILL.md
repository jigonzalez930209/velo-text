---
name: velo-text
description: >-
  Full velo-text library: PortableDocument AST, factories, validate/normalize/canonical
  hash, operations and History, {{path}} templates and repeat rows, LaTeX equations,
  assets (PNG/JPEG/WebP/SVG), S3 SigV4, Postgres contract, createEditor /
  mountVanillaEditor, themes, plugins, api-report slots, and PDF/ODT/DOCX export.
  Use whenever the user mentions velo-text, portable-doc, this editor, document
  templates, fill-and-export, or any package export of velo-text.
---

# velo-text (full library)

**1.0.0-beta.x** — install `velo-text@beta` until 1.0.0. Node >= 18. **Zero runtime dependencies.** Do not add React/Vue/pg/S3 SDKs to this package; they belong in the host app.

```bash
pnpm add velo-text@beta
npx velo-text@beta skill    # this skill → .cursor/skills + .agents/skills
```

**The document is JSON (`PortableDocument`). HTML is a view. PDF/ODT/DOCX are derived.** Same `document` + `data` + `assets` + `clock` → same PDF bytes.

Read the matching file before coding that area (one level deep):

| Task | File |
| --- | --- |
| Package subpaths, what to import where | [packages.md](packages.md) |
| AST, factories, validate, ops, History, equations | [model.md](model.md) |
| `{{path \| fmt ?? "x"}}`, repeat rows, `renderTemplate` | [template.md](template.md) |
| Web editor, commands, UX, framework hosts | [editor.md](editor.md) |
| `exportDocument` / `previewPdf` / sinks | [export.md](export.md) |
| Sniff, SVG, store, S3 | [assets.md](assets.md) |
| Node HTTP, PG contract, browser sinks | [adapters.md](adapters.md) |
| Themes / CSS tokens | [themes.md](themes.md) |
| `registerPlugin` / formatters / node types | [plugins.md](plugins.md) |
| Paste, proto, zip, images | [security.md](security.md) |

## Hard rules

- Core: no `window`, `document`, `fs`. Ports only: `Clock`, `IdGenerator`, `BinarySink`, `AssetResolver`.
- Editor DOM is **only** `createEditor` / `mountVanillaEditor`. Do not reconcile VDOM inside the host. `destroy()` on unmount. Toolbar `mousedown` → `preventDefault`.
- One PDF engine: `exportPdf` / `previewPdf` / `exportDocument({ format: "pdf" })`. Editor `setPagePreview` is chrome (metrics), not a second paginator.
- PDF fonts: Standard-14 (Helvetica family). Custom `fontFamily` is ignored in PDF; ODT/DOCX keep the family name.
- Server fill: `velo-text/api-report` + `velo-text/export` + `velo-text/backend`. Do not import `"velo-text"` on the server if you must keep the editor out of the bundle.
- Nested `table`/`columns` max depth **3**. Variables and equations are atomic (`contenteditable=false`).
- JSON Schema: `schemas/portable-doc-v1.json`. Locale default `es-AR`. Page default A4 µm.

## Minimal paths

**Browser host:** `velo-text` or `velo-text/vanilla` + `velo-text/themes/base.css` + `components.css`.

**Server export:** `reportSlots` / `dataFromSlotValues` / `assetsFromSlotValues` from `velo-text/api-report`; `exportDocument` from `velo-text/export`; `createBufferSink` from `velo-text/backend`.

**Headless AST only:** `velo-text/core` (+ `velo-text/template` if filling).
