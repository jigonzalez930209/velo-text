# Plugins

## Philosophy
Zero coupling — a plugin declares type, version, schema, normalizer, web renderer, serializers, export adapters, commands, migrations and contract tests. If a plugin does not define an output for a format, strict export fails with known code; tolerant mode inserts an accessible placeholder.

## Internal vs external
- **Internal**: bundled in `src/`, registered at build time (e.g. `equation`, `variable`). Zero-cost.
- **External**: loaded at runtime via `registerPlugin(pluginDef)`. Validated against schema, sandboxed (no prototype pollution, no `javascript:` URLs).

## Interface
```ts
interface PluginDef {
  type: string; version: number;
  schema: JSONSchema;
  createNode: (idGen) => BlockNode|InlineNode;
  normalize?: (node) => void;
  renderWeb: (node) => string; // HTML
  renderPdf?: (node, ctx) => void;
  renderOdt?: (node, ctx) => string;
  renderDocx?: (node, ctx) => string;
  commands?: CommandDef[];
  formatters?: Record<string, FormatterFn>;
  migrate?: (doc) => void;
}
```

## Registration
```ts
import { registerNodeType, registerFormatter, registerCommand, registerPlugin } from "portable-doc-editor";
registerNodeType("my-widget", MyWidgetNode);
registerFormatter("myFormat", (v) => String(v));
registerPlugin(myPluginDef); // external
// Validation: unknown props ignored unless explicit compatibility policy
```

## Example: equation plugin (internal)
See `src/core/equation/index.ts` (validate, `latexToHtml`), `src/core/model/types.ts` (`InlineEquationNode`, `EquationBlockNode`), `src/editor-web/view` (render), `src/export/*` (fallback `$latex$`).

## Security
- No HTML interpretation for variables, no `javascript:` URLs, asset checks.
- Plugin code runs in same isolate — external plugins are audited via `docs/threat-model.md`.

See `src/core/plugin/*` (new) and `src/public-api/index.ts`.
