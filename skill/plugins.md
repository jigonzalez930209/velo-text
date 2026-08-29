# Plugins

Internal plugins (equation, variable) ship in `src/` and are zero-cost. External: `registerPlugin(def)` at runtime — validate schema; no prototype pollution; no `javascript:` URLs. Missing format adapter: **strict** export fails; **tolerant** uses an accessible placeholder.

```ts
import {
  registerPlugin, unregisterPlugin, getPlugin, listPlugins,
  getNodeTypePlugin, isPluginNodeType, validatePluginCoverage,
  registerNodeType, registerFormatter,
} from "velo-text";

registerNodeType("my-widget", MyWidgetNode);
registerFormatter("myFormat", (v) => String(v));
registerPlugin({
  type: string,
  version: number,
  schema: JSONSchema,
  createNode: (idGen) => BlockNode | InlineNode,
  normalize?: (node) => void,
  renderWeb: (node) => string,
  renderPdf?: (node, ctx) => void,
  renderOdt?: (node, ctx) => string,
  renderDocx?: (node, ctx) => string,
  commands?: CommandDef[],
  formatters?: Record<string, FormatterFn>,
  migrate?: (doc) => void,
});
```

Unknown props ignored unless an explicit compatibility policy says otherwise. Plugin code shares the isolate — audit external plugins.
