# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [Unreleased]

### Added
- `History` drives editor undo; paste goes through `handlePaste`; shortcuts via `attachInputPipeline` (`nativeTyping`)
- `tests/security/`, `tests/integration/`, `LICENSE`, visual HTML snapshots gated in CI
- Playground Vite alias to `src/` (no `dist/` required for `playground:dev`)
- Table **row height** drag (`heightUm`) and a table actions button beside the table (does not cover cells)
- Image **align** (`left`/`center`/`right`) on `ImageBlockNode`; toolbar `setAlign` targets a selected figure
- PDF: contiguous table rows; PNG **area-average downscale** when display size is smaller than source pixels
- Playground, examples, and HTTP API export **PDF, ODT, and DOCX**
- `scripts/soak.js` repeated export; property tests in CI

### Changed
- Source files capped at **250 lines** (controller, view, PDF/DOCX writers, pagination, CSS, unit tests split)
- Table cell alignment (`setAlign`) targets the cell paragraph; render persists `text-align`
- PDF tables advance Y per row; images use sanitized XObject names; playground export always sends `assetBytes`

### Fixed
- Typing in table cells (menu overlay + parse moving text nodes)
- Column resize targeting the wrong table; image resize box sized to the `<img>`, not the figure
- PDF tables: no extra gap between rows (layout Y + draw height matched)

## [0.1.0] - 2026-08-27

### Added
- Phase 0–12 initial implementation — Hito A/B/C verticals:
  - Core: PortableDocument envelope, 8 block + 5 inline nodes + equations, factories with injected `IdGenerator`/`Clock`
  - Schema: JSON Schema `schemas/portable-doc-v1.json`, validator with JSON Pointer, canonical `sha256`
  - Normalize: idempotent merge of adjacent texts, table repair
  - Operations: insert/delete/split/join, selection mapping, `History` with coalescing
  - Template: lexer/parser for `{{path | format ?? "fallback"}}`, safe `safeResolve` (blocks `__proto__`), formatters `currency`/`date`/`number`, repeat rows with alias
  - Equation: simple LaTeX subset (`\frac`, `\sqrt`, `^/_`, greek) via `src/core/equation`, atomic nodes, export fallback `$latex$`
  - Icons: 28 inline SVGs via `currentColor` (`src/assets/icons`), recolorable via CSS
  - Editor: `contenteditable` reconciler, `MutationObserver`, IME, `beforeinput` pipeline, keyboard shortcuts, Tab tables, clipboard allowlist (1 MB), a11y toolbar nav & contrast
  - Assets: sniff (PNG/JPEG/WebP/SVG), dimensions, SHA-256, `AssetStore` dedupe/GC, S3 SigV4 presigned URLs
  - Layout: units (µm/pt/twip/EMU), greedy line break, pagination with widows/orphans, diagnostics, deterministic hash
  - Export: `XmlWriter`, `ZipWriter` STORE (+ DEFLATE optional), `PdfWriter`, `OdtWriter`, `DocxWriter`, `exportDocument` pipeline, validators `validatePdf/Odt/Docx`
  - Adapters: `postgres-contract` (jsonb + `001_init.sql`, optimistic concurrency, idempotency, keyset pagination), `s3-compatible`
  - Themes: 4 presets (`light-neutral`, `light-warm`, `dark-slate`, `dark-contrast`) + `themes/components.css`
  - Tests: unit + 99 conformance fixtures × 3 formats, 33 fixtures, golden sample `tests/conformance/golden`, visual HTML `tests/visual/snapshots`
  - CI: `pnpm` 11.24.0, `.github/workflows/ci.yml`, `check:types`/`circular`/`fixtures`/`smoke`/`fuzz`/`benchmark`
  - Docs: `docs/api-report.md`, `docs/threat-model.md`, `docs/perf-budgets.md`, `docs/release-checklist.md`, `docs/matriz-nodos-formatos.md`

### Security
- HTML paste allowlist, `javascript:` blocked, SVG sanitization, Zip bomb limits, S3 scoped keys, tenant isolation

[0.1.0]: https://github.com/velo-text/portable-doc-editor/releases/tag/v0.1.0
