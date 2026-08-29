# API overview

The npm surface is `src/public-api/index.ts`. Full generated list: [API report](/api-report).

| You need | Guide | API page |
| --- | --- | --- |
| Create / validate a document | [Data model](/guide/model) | [Core — model](/api/core-model), [schema](/api/core-schema), [ops](/api/core-operations) |
| Fill `{{vars}}` | [Template](/guide/template) | [Template](/api/template) |
| Backend slot map | [Backend slots](/guide/api-report) | `velo-text/api-report` |
| Mount the editor | [Editor](/guide/editor) | [Editor web](/api/editor) |
| Export | [Export](/guide/export) | [Export](/api/export), [layout](/api/layout) |
| Assets | [Assets](/guide/assets) | [Assets](/api/assets) |
| Theme | [Themes](/guide/themes) | [Theme](/api/theme) |
| Hosts | [Adapters](/guide/adapters) | [Adapters](/api/adapters), [public](/api/public) |

```ts
export {
  createDocument, createIdGenerator, createSystemClock,
  createParagraph, createHeading, createText, createVariable, createImageBlock, createTable, createEquation, createEquationBlock,
  validateDocument, assertValid, canonicalStringify, canonicalBytes, contentHashHex,
  normalizeDocument, isIdempotent, createTransaction,
  createCollapsedSelection, createRangeSelection, History,
  parseVariableSource, tokenizeVariablesInText, safeResolve, formatValue, renderTemplate, inspectVariables,
  XmlWriter, crc32, ZipWriter, PdfWriter, exportDocument,
  sniffImage, getDimensions, sanitizeSvg, getIconSvg, validateLatex,
  themes, themeCss, renderDocumentToHtml, registerCommand,
};
```

Ports: `BinarySink`, `AssetResolver`, `Clock`, `IdGenerator`.

`exportDocument({ format: "pdf" | "odt" | "docx" })`. `OdtWriter` / `DocxWriter` are re-exported.

Extensions: `registerNodeType`, `registerFormatter`, `registerCommand`, `registerPlugin`.
