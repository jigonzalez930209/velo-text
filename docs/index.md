---
layout: home
hero:
  name: portable-doc-editor
  text: Zero-deps document platform
  tagline: TypeScript strict · Variables &#123;&#123;name&#125;&#125; · Tables · Images · LaTeX · PDF/ODT/DOCX
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: View API
      link: /api/overview
    - theme: alt
      text: Playground
      link: /playground/
features:
  - title: Pure core, no DOM
    details: Canonical JSON AST, immutable transactions, selection, history, validation and canonical hash. Zero window/document/fs in core.
  - title: Rich editor
    details: contenteditable reconciler, MutationObserver, IME, keyboard, tables (cell edit, align, col/row resize), columns, clipboard allowlist, a11y, 28 recolorable SVG icons.
  - title: Template engine
    details: Typed VariableNode &#123;&#123;path | format ?? "fallback"&#125;&#125;, safe resolver, currency/date formatters, repeat-row alias with limit.
  - title: Deterministic export
    details: PDF (xref/trailer), ODT (mimetype STORE first), DOCX (rels/Content_Types) via internal XmlWriter/ZipWriter, 33 golden fixtures.
  - title: Assets & Storage
    details: Magic-signature sniff, dimensions, SHA-256 dedupe, S3 SigV4 presigned URLs, PG jsonb + revisions.
  - title: Layout & Theming
    details: Micrometer units, line breaking, pagination widows/orphans, 4 themes with CSS tokens, equation rendering.
---

## Quick start <Badge type="tip" text="pnpm only" />

```bash
pnpm add portable-doc-editor
pnpm install
pnpm run build
pnpm run test # 143 tests
```

```ts
import { createDocument, createIdGenerator, exportDocument } from "portable-doc-editor";
import { createBufferSink } from "portable-doc-editor/dist/adapters/backend/index.js";

const doc = createDocument({ idGenerator: createIdGenerator("doc") });
doc.root.children.push({
  type: "paragraph", id: "p1",
  children: [{ type: "text", id: "t1", text: "Hello " }, { type: "variable", id: "v1", path: "name", source: "{{name}}", valueType: "string" }]
});

const { sink, getBuffer } = createBufferSink();
await exportDocument({ document: doc, data: { name: "Ada" }, format: "pdf", sink, options: { deterministic: true } });
```

## Architecture in 30s

```
PortableDocument (AST JSON) — source of truth
  ├─ Core (model, ops, history, schema, normalize)
  ├─ Template (parser, resolver, formatter)
  ├─ Editor Web (view reconciler, input pipeline, tables, clipboard, a11y)
  ├─ Assets (sniff, dimensions, hashing, store, S3)
  ├─ Layout (units, text, pagination)
  ├─ Export (pdf, odt, docx, xml, zip, validate)
  ├─ Theme (tokens, 4 presets)
  └─ Adapters (browser, backend, PG, S3)
```

Explore the [Guide](/guide/introduction) and [API](/api/overview). Try the [Playground](/playground/).
