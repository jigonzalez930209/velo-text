# Export

`src/export/xml/writer.ts` — `XmlWriter` (escape, `declaration`, `open`/`selfClose`/`close`, `toBytes`).

`src/export/zip/*` — `crc32`, `ZipWriter` (STORE mandatory, DEFLATE optional via `deflate.ts`), `build()` → `Uint8Array` with `mimetype` STORE first.

`src/export/layout/*` — `units` (µm), `text` (`breakLines`, `getFontMetrics`), `pagination` (`paginateDocument` widows/orphans, diagnostics), `buildLayout`.

`src/export/pdf/writer.ts` — `PdfWriter` (`layout-pages.ts`, `stream.ts`, `assemble.ts`, `pdf-model.ts`). Tables draw closed cell rects and advance Y per row; images as XObjects (`/Im` + sanitized id).

`src/export/odt/writer.ts` — `OdtWriter` (ODF 1.3 package, manifest, `Equation` style).

`src/export/docx/writer.ts` — `DocxWriter` (`document-xml.ts`, `package-parts.ts`). OpenXML, rels, EMU, DrawingML; `columns` as a one-row table.

`src/export/index.ts` — `exportDocument({document,data,format,sink,assets,options})` pipeline, `validatePdf/Odt/Docx` in `validate.ts`, `normalizeXml`.

See `tests/conformance/` and `tests/fixtures/`.
