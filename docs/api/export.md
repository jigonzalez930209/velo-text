# Export

`src/export/xml/writer.ts` — `XmlWriter` (escape, `declaration`, `open`/`selfClose`/`close`, `toBytes`).

`src/export/zip/*` — `crc32`, `ZipWriter` (STORE mandatory, DEFLATE optional via `deflate.ts`), `build()` → `Uint8Array` with `mimetype` STORE first.

`src/export/layout/*` — `units` (µm), `text` (`breakLines`, `getFontMetrics`), `pagination` (`paginateDocument` widows/orphans, diagnostics), `buildLayout`.

`src/export/pdf/writer.ts` — `PdfWriter` (catalog/pages/streams/xref/trailer, base fonts, `$latex$`).

`src/export/odt/writer.ts` — `OdtWriter` (ODF 1.3 package, manifest, `Equation` style).

`src/export/docx/writer.ts` — `DocxWriter` (OpenXML, rels, EMU, DrawingML, SVG/WebP + PNG fallback).

`src/export/index.ts` — `exportDocument({document,data,format,sink,assets,options})` pipeline, `validatePdf/Odt/Docx` in `validate.ts`, `normalizeXml`.

See `tests/conformance/` and `tests/fixtures/`.
