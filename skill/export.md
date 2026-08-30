# Export

Pipeline: validate → `renderTemplate` → writer. Formats: `"pdf" | "odt" | "docx"`.

```ts
import { exportDocument, previewPdf, exportPdf, PDF_FILL_OPTIONS } from "velo-text";
// prefer velo-text/export on the server

await exportDocument({
  document,
  data: { customer: { name: "Ada" } },
  assets: { logo: { id: "logo", mediaType: "image/png", data: pngBytes } },
  format: "pdf",
  sink,
  options: {
    deterministic: true,
    strict: false,
    missingVariable: "empty", // error | empty | keep
  },
  clock, // fixed ISO for deterministic bytes
  idGenerator,
});
```

PDF path uses `exportPdf` (not the ODT/DOCX switch). `previewPdf` = same generator + `PDF_FILL_OPTIONS`. HTTP API must call this, not a second layout.

```ts
const { bytes, diagnostics, pages } = await previewPdf({ document, data, assets });
```

Writers also exported: `PdfWriter`, `OdtWriter`, `DocxWriter`, `XmlWriter`, `ZipWriter`, `crc32`.

## PDF specifics

- Layout: µm, greedy line break, widows/orphans, keep-together for images/rows.
- Fonts: unmarked text is Standard-14 Helvetica + Symbol. The four document faces `Velo Sans`, `Velo Serif`, `Velo Mono`, `Velo Display` (`DOCUMENT_FONTS`) are generated TTF bytes injected as `@font-face` in the editor and embedded as `/FontFile2` in PDF — same outlines. Aliases: sans-serif, serif, monospace, cursive. Unknown families stay Helvetica with `pdf-font-family-ignored`.
- Images: PNG area-average downscale to on-page size (96 dpi); JPEG passthrough. SVG: Office writers may PNG-fallback.
- Diagnostics: `collectPdfDiagnostics` — unmapped LaTeX, skipped images, etc.
- Page chrome in the editor (`setPagePreview`) uses `pdfPageMetrics` / `buildPdfPages` for size and count only.

ODT/DOCX visual parity vs PDF is weaker. ZIP: sanitized names, no `../`, STORE (+ optional DEFLATE).

Browser sink: `createBlobSink` / `createMemorySink` from adapters/browser (host samples). Node: `createBufferSink` / `createFileSink` (`velo-text/backend`).
