# Template Engine

## Grammar (EBNF)
```
variable = "{{", ws, path, [ws, "|", ws, format], [ws, "??", ws, string], ws, "}}" ;
path     = identifier, { ".", identifier | "[", integer, "]" } ;
format   = identifier, [":", formatArg] ;
```
Examples: `&#123;&#123;name&#125;&#125;`, `&#123;&#123;customer.address.city&#125;&#125;`, `&#123;&#123;invoice.total | currency:ARS&#125;&#125;`, `&#123;&#123;createdAt | date:dd/MM/yyyy&#125;&#125;`, `&#123;&#123;missing ?? "Sin datos"&#125;&#125;`

No JS execution; formatters are registered typed functions.

## API
```ts
const result = renderTemplate(document, data, {
  mode: "strict", locale: "es-AR", timezone: "America/Argentina/Buenos_Aires", missing: "error"
});
// → { document: materialized, diagnostics, usedVariables, unusedVariables }
```

## Security
- Own-property access only, blocks `__proto__`/`prototype`/`constructor`, max depth 10, max result length 10000, values become text nodes never HTML.

## Repeat rows
```ts
table.repeat = { path: "items", alias: "item", templateRowId: "tmpl" }
// Inside cell: {{item.name}} → cloned per collection element with new IDs
```
Handles empty collection (fallback row), limit 1000, header repeat on page split via layout.

See `src/template/parser/parser.ts`, `resolver/resolver.ts`, `formatter/`.
