# Fill tags on the backend → PDF

The editor stores `{{name}}` as a `VariableNode`. The backend does **not** parse HTML. Discover inject points with [`reportSlots`](/guide/api-report) (`velo-text/api-report`), then send AST + `data` + assets.

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
