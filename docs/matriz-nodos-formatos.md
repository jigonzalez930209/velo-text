# Matriz nodo × formato — Fase 0.1.1

| Nodo / feature | Web (editor) | PDF | ODT | DOCX | Notas |
|---|---|---|---|---|---|
| paragraph | ✅ | ✅ | ✅ text:p | ✅ w:p | alineación, indent |
| heading h1-h6 | ✅ | ✅ size | ✅ text:h | ✅ w:pStyle Heading{n} | outline level |
| quote | ✅ | ✅ italic | ✅ Quotation | ✅ w:pStyle Quote | — |
| list ordered/unordered | ✅ | ✅ •/1. | ✅ text:list | ✅ w:numPr | nested futuro |
| table (span, header) | ✅ edit cells, align, col/row resize | ✅ grid + cell text, row Y advance | ✅ table:table | ✅ w:tbl | repeat via materialize; `widthUm` / `heightUm` |
| columns | ✅ `.pde-columns` | ✅ side-by-side boxes | ✅ table-like | ✅ w:tbl | `createColumns` |
| image block PNG/JPEG | ✅ | ✅ directo | ✅ draw:image | ✅ wp:inline | WebP→PNG fallback |
| image block WebP | ✅ | ⚠️ variant | ✅ preserva | ✅ +fallback PNG | ver 8.3 |
| image block SVG | ✅ sanitized | ⚠️ subset | ✅ preserva | ✅ +fallback PNG | 5.1.3 |
| inline-image | ✅ | ⚠️ inline | ⚠️ frame | ⚠️ inline | — |
| variable &#123;&#123;path&#125;&#125; | ✅ atomic | ✅ materialized | ✅ materialized | ✅ materialized | node tipado |
| variable | format currency/date | ✅ Intl | ✅ text | ✅ text | locale/timezone explícitos |
| variable fallback ?? | ✅ | ✅ | ✅ | ✅ | — |
| variable en celda | ✅ | ✅ | ✅ | ✅ | — |
| repeat rows &#123;&#123;item.x&#125;&#125; | ✅ plantilla | ✅ clonado | ✅ clonado | ✅ clonado | límite 1000 |
| page-break | ✅ | ✅ | ✅ text:page-break | ✅ w:br page | — |
| horizontal-rule | ✅ | ✅ | ✅ | ✅ w:pBdr | — |
| marks bold/italic/underline/strike/code | ✅ | ⚠️ Helvetica base | ✅ text:span | ✅ w:rPr | color/fondo |
| color/background | ✅ token CSS | ⚠️ pending | ✅ | ✅ w:color | — |
| link | ✅ | ✅ annot? | ✅ text:a | ✅ w:hyperlink | block javascript: |
| hard-break | ✅ | ✅ | ✅ line-break | ✅ w:br | — |
| equation inline `equation` | ✅ atomic, `latexToHtml` frac/sqrt | ✅ `$latex$` text | ✅ text:span Equation | ✅ w:r italic `$latex$` | simple subset, atomic |
| equation block `equation-block` | ✅ centered display | ✅ centered `$latex$` | ✅ text:p Equation | ✅ w:p centered italic | block LaTeX, no OMML v1 |
| toolbar icons SVG | ✅ inline 16px currentColor | — | — | — | all in `src/assets/icons/index.ts:12`, color via `currentColor`/`--pde-icon-color` |

✅ = soportado en Hito A | ⚠️ = fallback/limitado | ❌ = fuera de alcance v1 (ver 2.2)
