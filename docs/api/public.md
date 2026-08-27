# Public API

`src/public-api/index.ts` — minimal surface, see `docs/api-report.md` for full list (64 exports).

```ts
export { createDocument, createIdGenerator, ... } from "../core/model/factories.js";
export { validateDocument, canonicalStringify, ... } from "../core/schema";
export { exportDocument, PdfWriter, ... } from "../export";
export { getIconSvg, validateLatex, ... } from "../assets|core/equation";
export { themes, renderDocumentToHtml, registerCommand } from "../theme|editor-web";
```

Plugins via `registerNodeType`, `registerFormatter`, `registerCommand`, `registerPlugin` (see `src/core/plugin`).

See `docs/api-report.md` and `package.json` `exports`.
