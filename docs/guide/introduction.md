# Introduction

**velo-text** is a portable document library: one JSON AST, one editor, one export API for **PDF, ODT, and DOCX**. Runtime `dependencies` is `{}`.

Current trial: **`1.0.2`** — `pnpm add velo-text@beta`. The API is not frozen. Install and token steps: [Publish to npm](/guide/publish). What is done vs next: [Roadmap](/guide/roadmap).

## What it is

- A **canonical document** (`PortableDocument`) — never HTML, Word, or PDF as source of truth.
- A **pure core** (no `window` / `document` / `fs`) plus a `contenteditable` host.
- Typed **variables** (`{{name}}`, paths, formatters, repeat rows).
- Tables, columns, images (PNG/JPEG/WebP/SVG), simple LaTeX.
- The **same** `exportDocument` call in the browser or on Node.

## What it is not (yet)

Real-time collaboration, import of arbitrary Word/LibreOffice files, OfficeMath, embedded TTF in PDF, or pixel-perfect Word layout. PostgreSQL and S3 are **ports** (SQL + SigV4), not bundled drivers. See [Roadmap](/guide/roadmap).

## Zero-dependency contract

`package.json:dependencies === {}` — `pnpm run check:zero-deps` in CI. Dev tools (`typescript`, `vitepress`, `c8`) are `devDependencies` only.

## How to read these docs

| If you want… | Go to |
| --- | --- |
| Install and first export | This page, then [Export](/guide/export) |
| Mental model | [Architecture](/guide/architecture) → [Data model](/guide/model) |
| Mount the editor | [Editor](/guide/editor) → [Adapters](/guide/adapters) |
| Fill `{{vars}}` | [Template engine](/guide/template) · [Backend slots](/guide/api-report) |
| Host persistence | [PostgreSQL](/guide/postgres) · [Assets & S3](/guide/assets) |
| Function list | [API overview](/api/overview) |
| Try it | [Playground](/playground/) |

## Install

```bash
pnpm add velo-text@beta
```

Node `>= 18`. This repo uses **pnpm `11.24.0`** only (`packageManager`).

```bash
pnpm install
pnpm run build          # tsc → dist/
pnpm run check:types
pnpm run test
pnpm run docs:dev       # VitePress + playground at /playground/
```

## Minimal export

```ts
import { createDocument, createIdGenerator, exportDocument } from "velo-text";
import { createBufferSink } from "velo-text/backend";

const doc = createDocument({ idGenerator: createIdGenerator("doc") });
doc.root.children.push({
  type: "paragraph",
  id: "p1",
  children: [
    { type: "text", id: "t1", text: "Hello " },
    { type: "variable", id: "v1", path: "name", source: "{{name}}", valueType: "string" },
  ],
});

const { sink, getBuffer } = createBufferSink();
await exportDocument({
  document: doc,
  data: { name: "Ada" },
  format: "pdf",
  sink,
  options: { deterministic: true },
});
```

Mounting a visual editor: [Editor](/guide/editor). CSS: `velo-text/themes/base.css` and `velo-text/themes/components.css`.
