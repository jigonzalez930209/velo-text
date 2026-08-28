# Public API

`src/public-api/index.ts` — minimal surface, see `docs/api-report.md` for full list (64 exports).

```ts
export { createDocument, createIdGenerator, createTable, createColumns, ... } from "../core/model/factories.js";
export { createEditor, renderDocumentToHtml, renderBlocksToHtml } from "../editor-web";
export { exportDocument, PdfWriter } from "../export";
export { themes, setTheme } from "../theme";
```

Plugins via `registerNodeType`, `registerFormatter`, `registerCommand`, `registerPlugin` (see `src/core/plugin`).

See `docs/api-report.md` and `package.json` `exports`.
