# Node × format matrix

Product columns: **Web + PDF + ODT + DOCX**. Office visual fidelity vs PDF is weaker for tables, columns, and some images. This table is the source of truth for “what ships”.

| Nodo / feature | Web (editor) | PDF | ODT | DOCX | Notas |
|---|---|---|---|---|---|
| paragraph | ✅ | ✅ | ✅ text:p | ✅ w:p | alineación, indent |
| heading h1-h6 | ✅ | ✅ size | ✅ text:h | ✅ w:pStyle Heading{n} | outline level |
| quote | ✅ | ✅ italic | ✅ Quotation | ✅ w:pStyle Quote | — |
| list ordered/unordered | ✅ | ✅ •/1. | ✅ text:list | ✅ w:numPr | nested futuro |
| table (span, header) | ✅ edit cells, align, col/row resize | ✅ grid continuo, Y por fila | ⚠️ table:table | ⚠️ w:tbl | v1 PDF sin hueco entre filas |
| columns | ✅ `.pde-columns` | ✅ celdas lado a lado | ⚠️ table-like | ⚠️ w:tbl | `createColumns` |
| image block PNG | ✅ resize, align L/C/R | ✅ XObject + **downscale** si el tamaño en página es menor que el original | ⚠️ draw:image | ⚠️ wp:inline | 96 dpi de µm |
| image block JPEG | ✅ | ✅ DCT passthrough (sin downscale) | ⚠️ | ⚠️ | no hay decoder JPEG |
| image block WebP | ✅ | ⚠️ no raster | ⚠️ | ⚠️ +placeholder PNG | v1.5 producto |
| image block SVG | ✅ sanitized | ⚠️ no raster | ⚠️ | ⚠️ +placeholder PNG | 5.1.3 |
| inline-image | ✅ | ⚠️ | ⚠️ | ⚠️ | — |
| variable `{{path}}` | ✅ atomic | ✅ materialized | ✅ | ✅ | node tipado |
| variable \| format | ✅ Intl | ✅ text | ✅ | ✅ | locale explícito |
| variable fallback ?? | ✅ | ✅ | ✅ | ✅ | — |
| variable en celda | ✅ | ✅ | ✅ | ✅ | — |
| repeat rows | ✅ plantilla | ✅ clonado | ✅ | ✅ | límite 1000 |
| page-break | ✅ | ✅ | ✅ | ✅ w:br page | — |
| horizontal-rule | ✅ | ✅ | ✅ | ✅ w:pBdr | — |
| marks bold/italic/underline/strike/code | ✅ | ⚠️ Helvetica | ✅ | ✅ w:rPr | color/fondo en editor |
| color/background | ✅ | ⚠️ pending PDF | ⚠️ | ⚠️ | — |
| link | ✅ | ⚠️ | ✅ text:a | ✅ w:hyperlink | block `javascript:` |
| hard-break | ✅ | ✅ | ✅ | ✅ w:br | — |
| equation inline | ✅ `latexToHtml` | ✅ Helvetica+Symbol | ⚠️ `$latex$` | ⚠️ italic `$latex$` | subset, no OMML |
| equation block | ✅ display | ✅ centered | ⚠️ | ⚠️ | — |
| toolbar icons SVG | ✅ currentColor | — | — | — | `src/assets/icons` |

✅ = v1 producto (Web/PDF) o base interna usable · ⚠️ = limitado / no producto · ❌ = fuera de v1 (§2.2)
