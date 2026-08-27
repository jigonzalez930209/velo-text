# Layout

`src/export/layout/units.ts` — `UM_PER_INCH=25400`, `ptToUm`, `umToPt`, `pxToUm`, `twipToUm`, `emuToUm`, `mmToUm`, `clampUm`.

`src/export/layout/text.ts` — `FontMetrics`, `getFontMetrics`, `breakLines` (greedy, `\n`/`\t`, fallback), `estimateRunWidth`, `findMissingGlyphs`.

`src/export/layout/pagination.ts` — `paginateDocument(doc, {widows,orphans}) → {pages, diagnostics, hash}`. Flow helpers: `layout-types.ts`, `layout-flow.ts`, `layout-blocks.ts`, `layout-structured.ts` (table / columns / image / equation-block / page-break).

See `src/export/layout/index.ts` (`buildLayout`).
