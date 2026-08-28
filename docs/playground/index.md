# Playground

Interactive demo — Vite app in `playground/`. CSS is imported (`themes/base.css`, `themes/components.css`, `playground.css`); the parent repo is allowed via `playground/vite.config.ts`.

```bash
pnpm playground:dev
```

Vite aliases `portable-doc-editor` to `src/` (no `dist/` required). Restart the dev server if HMR misses a controller change.

## What it covers

- Paragraphs, headings, quotes, lists, **column layouts**, LaTeX inline/block
- Variables `{{name}}` (atomic chips; popover path/format/fallback)
- **Tables**: type in cells; toolbar align; drag column edges and row bottoms; table button for insert/delete row/column and merge
- **Images**: file picker, blob URLs via `resolveAssetUrl`, resize overlay, **left/center/right** via the same align toolbar after clicking the image
- Block handles on the left: drag to reorder, `+` to insert a block
- Theme select (`light-neutral`, `light-warm`, `dark-slate`, `dark-contrast`)
- Export **PDF, ODT, DOCX** (in-memory `assetBytes` so images embed). PNG pixels are downscaled in PDF when the image is smaller than the source.

See `playground/src/main.ts` and `examples/vanilla-web.html`.
