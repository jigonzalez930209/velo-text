# Export

**PDF is the product path.** Preview in the playground and a Vercel/Express handler must call the same function: `exportPdf({ document, data, assets, options })`. `exportDocument({ format: "pdf", sink })` is a thin wrapper around `exportPdf`.

```ts
import { exportPdf } from "velo-text";

// Express / Vercel (Node runtime, no DOM)
const { bytes, diagnostics, pages } = await exportPdf({
  document,
  data,
  assets, // id → { mediaType, data: Uint8Array }
  options: { strict: false, missingVariable: "keep" },
});
// res.setHeader("content-type", "application/pdf"); res.send(Buffer.from(bytes));
```

Do not reimplement layout, fonts, or images in the host. Diagnostics list translation gaps (unmapped LaTeX, skipped cell/column blocks, missing images, ignored text marks).

`exportDocument` still accepts `odt` / `docx` for existing hosts; new work stays on PDF.

## Pipeline (PDF)
```
PortableDocument → validate → resolve variables → collectPdfDiagnostics → PdfWriter (buildPdfPages + images + assemble)
```

Page size and margins come from `document.page` (same MediaBox as layout). Fonts: Helvetica + Symbol. Images: PNG downscale / JPEG passthrough. Missing assets: `[missing image …]`.

## ODT / DOCX

`OdtWriter` / `DocxWriter` via `exportDocument`. MIME types:

- ODT `application/vnd.oasis.opendocument.text`
- DOCX `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Table/image/column fidelity vs PDF is still weaker in Office packages (roadmap §2.4). SVG/WebP may become placeholder PNG in DOCX.

## ZIP
Internal `ZipWriter`: CRC-32, local headers, central directory, EOCD, STORE mandatory, DEFLATE optional via `deflate.ts`.

See `src/export/pdf/*`, `src/export/odt/*`, `src/export/docx/*`, `src/export/images/*`, `src/export/index.ts`.
