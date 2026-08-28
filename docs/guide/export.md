# Export

Call `exportDocument({ document, data, format, sink, assets, options })` with `format: "pdf" | "odt" | "docx"`. Pass in-memory `assets` (id → `{ mediaType, data }`) so images embed.

Playground, `examples/vanilla-web.html`, `examples/backend.mjs`, and `POST /documents/:id/export?format=` (`examples/http-api.mjs`) all expose the three formats. Package checks: `validatePdf`, `validateOdt`, `validateDocx`. Opening in LibreOffice/Word is still a manual/host check (not CI).

## Common pipeline
```
PortableDocument → validate+migrate → resolve variables → resolve assets → normalize → buildLayout → adapt → package → validate output
```

## PDF
- Objects: Catalog, Pages, streams, xref, trailer, deterministic numbering
- Fonts: Type1 Helvetica + Symbol (LaTeX subset); TTF embed is not in v1
- **Tables:** each row is a contiguous grid (cell height matches layout; no extra gap between rows)
- **Images:**
  - Placement follows `ImageBlockNode.align` (`left` / `center` / `right`)
  - Size from `widthUm` / `heightUm`
  - PNG pixels larger than the on-page size are **area-averaged down** at 96 dpi of those µm before embedding (`src/export/images/`)
  - JPEG is passed through (no decoder); SVG/WebP are not rasterized in PDF v1
- Missing assets render as `[missing image …]`
- `validatePdf` checks header/xref/EOF

## ODT / DOCX

`OdtWriter` / `DocxWriter` via `exportDocument`. MIME types:

- ODT `application/vnd.oasis.opendocument.text`
- DOCX `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Table/image/column fidelity vs PDF is still weaker in Office packages (roadmap §2.4). SVG/WebP may become placeholder PNG in DOCX.

## ZIP
Internal `ZipWriter`: CRC-32, local headers, central directory, EOCD, STORE mandatory, DEFLATE optional via `deflate.ts`.

See `src/export/pdf/*`, `src/export/odt/*`, `src/export/docx/*`, `src/export/images/*`, `src/export/index.ts`.
