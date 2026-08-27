# Matriz nodo × formato — Fase 0.1.1

| Nodo / feature | Web (editor) | PDF | ODT | DOCX | Notas |
|---|---|---|---|---|---|
| paragraph | ✅ | ✅ | ✅ text:p | ✅ w:p | alineación, indent |
| heading h1-h6 | ✅ | ✅ size | ✅ text:h | ✅ w:pStyle Heading{n} | outline level |
| quote | ✅ | ✅ italic | ✅ Quotation | ✅ w:pStyle Quote | — |
| list ordered/unordered | ✅ | ✅ •/1. | ✅ text:list | ✅ w:numPr | nested futuro |
| table (span, header) | ✅ | ✅ | ✅ table:table | ✅ w:tbl | repeat via materialize |
| image block PNG/JPEG | ✅ | ✅ directo | ✅ draw:image | ✅ wp:inline | WebP→PNG fallback |
| image block WebP | ✅ | ⚠️ variant | ✅ preserva | ✅ +fallback PNG | ver 8.3 |
| image block SVG | ✅ sanitized | ⚠️ subset | ✅ preserva | ✅ +fallback PNG | 5.1.3 |
| inline-image | ✅ | ⚠️ inline | ⚠️ frame | ⚠️ inline | — |
| variable {{path}} | ✅ atomic | ✅ materialized | ✅ materialized | ✅ materialized | node tipado |
| variable | format currency/date | ✅ Intl | ✅ text | ✅ text | locale/timezone explícitos |
| variable fallback ?? | ✅ | ✅ | ✅ | ✅ | — |
| variable en celda | ✅ | ✅ | ✅ | ✅ | — |
| repeat rows {{item.x}} | ✅ plantilla | ✅ clonado | ✅ clonado | ✅ clonado | límite 1000 |
| page-break | ✅ | ✅ | ✅ text:page-break | ✅ w:br page | — |
| horizontal-rule | ✅ | ✅ | ✅ | ✅ w:pBdr | — |
| marks bold/italic/underline/strike/code | ✅ | ⚠️ Helvetica base | ✅ text:span | ✅ w:rPr | color/fondo |
| color/background | ✅ token CSS | ⚠️ pending | ✅ | ✅ w:color | — |
| link | ✅ | ✅ annot? | ✅ text:a | ✅ w:hyperlink | block javascript: |
| hard-break | ✅ | ✅ | ✅ line-break | ✅ w:br | — |
| hard-break | ✅ | ✅ | ✅ | ✅ | — |

✅ = soportado en Hito A | ⚠️ = fallback/limitado | ❌ = fuera de alcance v1 (ver 2.2)
