# Introduction

## Goal
`portable-doc-editor` is a self-contained, zero-runtime-dependency document platform that edits rich text, inserts variables `&#123;&#123;name&#125;&#125;`, handles tables/images/LaTeX and exports the same document to **PDF, ODT and DOCX** from browser or backend.

## Zero-dependency contract
`package.json:dependencies === {}` — verified by `pnpm run check:zero-deps` and CI. Only standard JS, Web APIs and code inside the repo. Dev tools (`typescript`, `vitepress`, `c8`) are devDeps only.

## Source of truth
Never HTML/DOCX/ODT/PDF. The canonical document is a versioned JSON AST (`PortableDocument`). HTML is an editable view; PDF/ODT/DOCX are derived outputs.

## Packages
- `pnpm@11.24.0` only (`packageManager` field). CI uses `pnpm/action-setup`.

## Getting started
```bash
pnpm install
pnpm run build        # tsc → dist/
pnpm run check:types  # strict
pnpm run test         # 143 tests
pnpm run docs:dev     # vitepress
```

## Hitos
- **Hito A**: AST v1, paragraph, `&#123;&#123;name&#125;&#125;`, PNG/JPEG, JSON save, 3 exporters
- **Hito B**: Tables, 4 themes, S3, PG revisions, image export, a11y
- **Hito C**: Repeat rows, SVG/WebP fallback, robust layout, fuzz/benchmarks, docs
