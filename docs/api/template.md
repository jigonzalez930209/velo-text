# Template

`src/template/parser/parser.ts` — `parseVariableSource("&#123;&#123;a.b | currency:ARS ?? \"fallback\"&#125;&#125;")`, `tokenizeVariablesInText`.

`src/template/resolver/resolver.ts` — `safeResolve(data,path)` (own props, blocks `__proto__`), `formatValue` (`currency`, `date:dd/MM/yyyy`, `number`, `percent`, `upper/lower`), `renderTemplate(doc,data,opts)` with diagnostics and repeat-row cloning (`repeat:{path,alias,templateRowId}`), `inspectVariables`.

`src/template/formatter/index.ts` — `formatters` registry, `registerFormatter`.

See `tests/fixtures/12-*` and `16-repeat-rows`.
