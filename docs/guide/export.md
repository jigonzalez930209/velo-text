# Export

There is **one PDF constructor**: `exportPdf` in `src/export/pdf/export-pdf.ts` (`PdfWriter` → `buildPdfPages` → `assemblePdf`). No DOM.

| Host | Must call |
| --- | --- |
| Playground preview iframe + download | `previewPdf` (same as `exportPdf` + `PDF_FILL_OPTIONS`) |
| HTTP API (`handlePdfExportJson`) | `exportPdf` + `PDF_FILL_OPTIONS` |
| `exportDocument({ format: "pdf" })` | wraps `exportPdf` |

Same `document` + `data` + `assets` + `clock` → **same bytes**. Do not layout PDF in the editor with a second paginator.

ODT/DOCX still go through `exportDocument` (template pass, then those writers). Visual parity vs PDF is weaker ([Roadmap](/guide/roadmap), [matrix](/matriz-nodos-formatos)).

```ts
import { previewPdf, exportDocument, PDF_FILL_OPTIONS } from "velo-text";

const { bytes, diagnostics, pages } = await previewPdf({
  document,
  data,
  assets, // id → { mediaType, data: Uint8Array }
});

await exportDocument({ document, data, format: "odt", sink, options: { deterministic: true } });
```

Editor **page chrome** (`setPagePreview`) uses `pdfPageMetrics` / `buildPdfPages` for paper size and page count. It is not a second PDF engine. The pixel-true preview is the `previewPdf` iframe.

## Pipeline (PDF)

```
PortableDocument → validate → renderTemplate → PdfWriter (buildPdfPages + images + assemble)
```

Page size and margins: `document.page` (same MediaBox). Fonts: Helvetica + Symbol. Images: PNG downscale / JPEG passthrough.

## ODT / DOCX

| Format | MIME |
| --- | --- |
| ODT | `application/vnd.oasis.opendocument.text` |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

## ZIP

Internal `ZipWriter`: CRC-32, local headers, central directory, EOCD. STORE required; DEFLATE optional (`deflate.ts`).

See `src/export/pdf/*`, `src/export/odt/*`, `src/export/docx/*`, `src/export/images/*`.
