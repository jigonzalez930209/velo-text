# Export

`src/export/xml/writer.ts` — `XmlWriter` (escape, `declaration`, `open`/`selfClose`/`close`, `toBytes`).

`src/export/zip/*` — `crc32`, `ZipWriter` (STORE mandatory, DEFLATE optional via `deflate.ts`), `build()` → `Uint8Array`.

`src/export/layout/*` — `units` (µm), `text` (`breakLines`, `getFontMetrics`), `pagination` (`paginateDocument` widows/orphans, diagnostics), `buildLayout`.

`src/export/pdf/writer.ts` — `PdfWriter` (`layout-pages.ts`, `stream.ts`, `assemble.ts`, `pdf-model.ts`). Tables: contiguous cell rects (row height from layout). Images: XObjects, `align`, PNG downscale via `src/export/images/prepare.ts`.

`src/export/images/` — `downsampleRgb` (area average), `encodePngRgb` (deterministic stored zlib), `prepareExportImages` (max on-page `widthUm`/`heightUm` per asset, never upscale). JPEG is not decoded.

`src/export/odt/writer.ts` / `src/export/docx/writer.ts` — ODT/DOCX packages via `exportDocument`.

`src/export/index.ts` — `exportDocument({ document, data, format, sink, assets, options })` with `format: "pdf" | "odt" | "docx"`.

See `tests/conformance/` (fixtures still exercise internal ODT/DOCX packages) and `tests/unit/image-export.test.js`.
