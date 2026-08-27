# Export

## Common pipeline
```
PortableDocument → validate+migrate → resolve variables → resolve assets → normalize → buildLayout → adapt → package → validate output
```
Intermediate layout `pages, boxes, lines, tables, images, links` is shared; DOCX/ODT do client-side pagination but share normalizer.

## PDF
- Objects: Catalog, Pages, streams, xref, trailer, deterministic numbering
- Fonts: Type1 Helvetica for prototype, embed for prod, cmap/widths, Unicode mapping
- Images: PNG/JPEG direct, SVG subset, WebP via variant
- Metadata, bookmarks, compression optional (`DEFLATE` via injected `zlib`)

## ODT
ODF 1.3 package: `mimetype` (STORE first), `META-INF/manifest.xml`, `content.xml`, `styles.xml`, `meta.xml`, `settings.xml`, `Pictures/*`. Dedupe styles by hash, validation via ODF schema in CI, tested in LibreOffice/Word.

## DOCX
Open XML: `[Content_Types].xml`, `_rels/.rels`, `word/document.xml`, `word/styles.xml`, `word/settings.xml`, `word/_rels/document.xml.rels`, `word/media/*`, `docProps/*`. Deterministic rel IDs, EMU conversion, DrawingML inline images, SVG/WebP + PNG fallback.

## ZIP
Internal `ZipWriter`: CRC-32, local headers, central directory, EOCD, STORE mandatory, DEFLATE optional via `deflate.ts` (Node `zlib` or `CompressionStream`).

See `src/export/pdf|odt|docx|xml|zip|validate.ts` and `src/export/index.ts`.
