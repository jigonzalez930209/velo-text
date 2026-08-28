# API Overview

Minimal surface (`src/public-api/index.ts`):

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
  themes, themeCss, renderDocumentToHtml, registerCommand
}
```

Ports: `BinarySink`, `AssetResolver`, `Clock`, `IdGenerator` — inject `Blob` (browser), streams (backend) or buffers (tests).

Hosts call `exportDocument` with `format: "pdf" | "odt" | "docx"`. `OdtWriter` / `DocxWriter` are also re-exported. See [Export](/guide/export).

Extensions via `registerNodeType`, `registerFormatter`, `registerCommand`, `registerPlugin`.

See subpages for each module and `docs/api-report.md`.
