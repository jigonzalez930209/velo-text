# Introduction

## Status
**1.0.0-beta.1** — first public npm trial (`pnpm add velo-text@beta`). Not a frozen 1.0 API. See [Publish to npm](/guide/publish) for install and how to store the npm token.

## Goal
`velo-text` is a self-contained, zero-runtime-dependency document platform that edits rich text, inserts variables `&#123;&#123;name&#125;&#125;`, handles tables (including cell alignment and column/row resize), column layouts, images and LaTeX, and exports the same document to **PDF, ODT, and DOCX** from browser or backend. LibreOffice/Word CI and full Office visual parity remain open.

## Zero-dependency contract
`package.json:dependencies === {}` — verified by `pnpm run check:zero-deps` and CI. Only standard JS, Web APIs and code inside the repo. Dev tools (`typescript`, `vitepress`, `c8`) are devDeps only.

## Source of truth
Never HTML/DOCX/ODT/PDF. The canonical document is a versioned JSON AST (`PortableDocument`). HTML is an editable view; PDF, ODT, and DOCX are derived outputs.

## Packages
- `pnpm@11.24.0` only (`packageManager` field). CI uses `pnpm/action-setup`.

## Getting started
```bash
pnpm add velo-text@beta   # consumers
pnpm install              # this repo
pnpm run build            # tsc → dist/
pnpm run check:types      # strict
pnpm run test             # unit + conformance + integration + security
pnpm run docs:dev         # vitepress (playground at /playground/)
```

## Hitos
- **Hito A**: AST v1, paragraph, `&#123;&#123;name&#125;&#125;`, PNG/JPEG, JSON save, PDF export
- **Hito B**: Tables, 4 themes, S3, PG revisions, image export, a11y
- **Hito C**: Repeat rows, layout, fuzz/benchmarks, docs; product PDF/ODT/DOCX (`exportDocument`)
