# Fill tags on the backend → PDF

The editor stores `{{name}}` as a `VariableNode`. The backend does **not** parse the HTML. It receives the AST plus a `data` map and `exportPdf` / `handlePdfExportJson` substitutes every tag.

```json
{
  "document": { "...editor.getDocument()..." },
  "data": { "name": "Ada Lovelace", "total": 1280, "customer": { "name": "Acme" } }
}
```

Same body for:

<<< @/../examples/backend/client-fill.js

<<< @/../examples/backend/vite.config.ts

<<< @/../examples/backend/express.ts

<<< @/../examples/backend/vercel-api.ts
