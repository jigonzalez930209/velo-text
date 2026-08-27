# Public API Report — portable-doc-editor v0.1.0
Generated: 2026-08-27T15:14:02.669Z

## Exports from `src/public-api`
- `AssetRef`
- `AssetResolver`
- `BinarySink`
- `BlockNode`
- `Clock`
- `DocxWriter`
- `EquationBlockNode`
- `ExportFormat`
- `ExportRequest`
- `ExportResult`
- `History`
- `IconName`
- `IconOptions`
- `IdGenerator`
- `InlineEquationNode`
- `InlineNode`
- `OdtWriter`
- `PageSettings`
- `PdfWriter`
- `PortableDocument`
- `RangeSelection`
- `Selection`
- `TextNode`
- `VariableNode`
- `XmlWriter`
- `ZipWriter`
- `allThemesCss`
- `assertValid`
- `canonicalBytes`
- `canonicalStringify`
- `contentHashHex`
- `crc32`
- `createCollapsedSelection`
- `createDocument`
- `createEquation`
- `createEquationBlock`
- `createHeading`
- `createIdGenerator`
- `createImageBlock`
- `createParagraph`
- `createRangeSelection`
- `createSystemClock`
- `createTable`
- `createText`
- `createTransaction`
- `createVariable`
- `equationCss`
- `exportDocument`
- `formatValue`
- `getAllIcons`
- `getCommand`
- `getDimensions`
- `getIconSvg`
- `iconCss`
- `inspectVariables`
- `intentToOperation`
- `isAllowedMediaType`
- `isCollapsed`
- `isIdempotent`
- `latexToHtml`
- `latexToPlainText`
- `listCommands`
- `mapSelectionThroughOps`
- `normalizeDocument`
- `parseVariableSource`
- `reconcileDom`
- `registerCommand`
- `renderDocumentToHtml`
- `renderTemplate`
- `safeResolve`
- `sanitizeSvg`
- `sniffImage`
- `themeCss`
- `themes`
- `tokenizeVariablesInText`
- `validateDocument`
- `validateLatex`

## Entry points (package.json exports)
- `.`: {"types":"./dist/public-api/index.d.ts","default":"./dist/public-api/index.js"}
- `./core`: {"types":"./dist/core/model/index.d.ts","default":"./dist/core/model/index.js"}
- `./template`: {"types":"./dist/template/index.d.ts","default":"./dist/template/index.js"}
- `./export`: {"types":"./dist/export/index.d.ts","default":"./dist/export/index.js"}
- `./editor-web`: {"types":"./dist/editor-web/index.d.ts","default":"./dist/editor-web/index.js"}

## Zero runtime dependencies
PASS — no runtime deps

## Types
- Main types: `dist/public-api/index.d.ts`
- Declarations: `dist/public-api/index.d.ts`

## Changelog guidance
- Follow semver: breaking changes require major bump
- Document deprecations in CHANGELOG.md before removal
