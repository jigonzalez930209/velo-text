# Layout

## Units
Internal: micrometers (int). Conversions with specified rounding:
- `1 pt = 352.777µm`, `1 twip = 17.638µm`, `1 EMU = 0.0277µm`, `1 px@96dpi = 264.58µm`
- `ptToUm`, `umToPt`, `pxToUm`, `twipToUm`, `emuToUm` in `src/export/layout/units.ts`

## Text
`getFontMetrics` approximates avg char width/line height from `fontSizePt`. `breakLines` is greedy, respects spaces/tabs/`\n`, hard breaks, fallback inside long words, deterministic.

## Blocks & tables
Margins collapsed per own rules, `keep-with-next` for headings, row split diagnostics, header repeat. Images flagged if `w/h > usable`.

## Pagination
`paginateDocument(doc, {widows:2, orphans:2})` does vertical flow, forced breaks, widows/orphans, image constraints. Deterministic: same input + fixed IDs/clock → same `hash` and `pages[].boxes`.

## Diagnostics
`image-too-large`, `row-too-tall`, `missing-glyph`, `unknown-block`.

See `src/export/layout/*`.
