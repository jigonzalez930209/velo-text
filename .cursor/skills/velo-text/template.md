# Templates

No JS eval. Formatters are registered functions.

## Grammar

```
{{ path [| format[:arg]] [?? "fallback"] }}
path = ident { .ident | [int] }
```

Examples: `{{name}}`, `{{customer.address.city}}`, `{{invoice.total | currency:ARS}}`, `{{createdAt | date:dd/MM/yyyy}}`, `{{missing ?? "Sin datos"}}`.

## API

```ts
import { parseVariableSource, tokenizeVariablesInText, safeResolve, formatValue, renderTemplate, inspectVariables } from "velo-text";
// or velo-text/template

parseVariableSource("{{a.b | currency:USD ?? \"x\"}}");
const rendered = renderTemplate(document, data, {
  mode: "strict", // or "tolerant"
  locale: "es-AR",
  timezone: "America/Argentina/Buenos_Aires",
  missing: "error", // "empty" | "keep"
});
// { document, diagnostics, usedVariables, unusedVariables }
inspectVariables(document);
```

`safeResolve` — own-property only; blocks `__proto__` / `prototype` / `constructor`; max depth 10; max string length 10000; results are **text**, never HTML.

Built-in formatters include `currency`, `date`, `number`. Extra: `registerFormatter(name, fn)`.

## Repeat rows

```ts
table.repeat = { path: "items", alias: "item", templateRowId: table.rows[0].id };
// cell: {{item.name}}  → clone template row per element, new ids
```

Empty collection → fallback row. Cap 1000 rows. Layout can repeat header rows on page split.

## Export fill

`exportDocument({ document, data, assets, ... })` runs `renderTemplate` before writers. `missingVariable`: `"error" | "empty" | "keep"`.
