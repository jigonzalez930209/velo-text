# Playground

Interactive demo — Vite app in `playground/`. CSS is imported (`themes/base.css`, `themes/components.css`, `playground.css`); the parent repo is allowed via `playground/vite.config.ts`.

```bash
pnpm run build
pnpm playground:dev
```

The playground imports the built public API from `dist/public-api/index.js`. Restart Vite after `pnpm run build` when editor or theme CSS changes.

## What it covers

- Paragraphs, headings, quotes, lists, **2-column layouts**, LaTeX inline/block
- Variables `{{name}}` (atomic chips)
- **Tables**: type in cells; toolbar left/center/right/justify; drag column edges and row bottoms; table button (right of the table) for insert/delete row/column
- Images: file picker, blob URLs via `resolveAssetUrl`, resize overlay on the `<img>` box
- Block handles on the left: drag to reorder, `+` to insert a block
- Theme select (`light-neutral`, `light-warm`, `dark-slate`, `dark-contrast`) applies tokens on wrapper, editor, `html`, and `body`
- Export PDF / ODT / DOCX (playground always passes in-memory `assetBytes` so images are not missing in PDF)

See `playground/src/main.ts` and `examples/`.
