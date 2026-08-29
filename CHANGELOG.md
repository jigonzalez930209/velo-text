# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [Unreleased]

### Added
- CLI `npx velo-text@beta skill` / `pnpx velo-text@beta skill` installs the agent skill into `.cursor/skills` and `.agents/skills`









## [1.0.0-beta.8] - 2026-08-29

### Added
- 

## [1.0.0-beta.7] - 2026-08-29

### Added
- 

## [1.0.0-beta.6] - 2026-08-29

### Added
- 

## [1.0.0-beta.5] - 2026-08-28

### Added
- 

## [1.0.0-beta.4] - 2026-08-28

### Added
- 

## [1.0.0-beta.3] - 2026-08-28

### Added
- 

## [1.0.0-beta.2] - 2026-08-28

### Added
- 

## [1.0.0-beta.1] - 2026-08-28

### Added
- 

## [1.0.0-beta.0] - 2026-08-28

First public **beta** on npm (`velo-text@beta`). Treat it as a trial API: layout, editor chrome, and export can still change before 1.0.0.

### Added
- npm package surface: `files`, `exports` (including `./themes/*` and `./backend`), `publishConfig.tag` `beta`, GitHub Action **Publish npm** (`NPM_TOKEN` secret)
- Playground in VitePress (`docs:dev` → `/playground/`); framework samples (Vanilla, React, Vue, Svelte, Angular, Astro)
- PDF **keep-together**: images, table rows, and lines move to the next page instead of being split; images scale to the usable page
- Overlay menus: `placeOverlay` keeps dropdowns inside the viewport (right-side icons open to the left)
- Editor page preview pushes blocks that would straddle a page band
- `History` drives editor undo; paste goes through `handlePaste`; shortcuts via `attachInputPipeline` (`nativeTyping`)
- Table **row height** drag (`heightUm`) and a table actions button beside the table
- Image **align** (`left`/`center`/`right`) on `ImageBlockNode`
- PDF: contiguous table rows; PNG **area-average downscale**
- Playground, examples, and HTTP API export **PDF, ODT, and DOCX**
- `scripts/soak.js`; property tests in CI

### Changed
- Version scheme jumps from `0.1.0` to `1.0.0-beta.0` for a named public trial
- Source files capped at **250 lines** where split
- Table cell alignment (`setAlign`) targets the cell paragraph

### Fixed
- Toolbar dropdowns inheriting VitePress muted colors (looked disabled)
- Menus clipped by `backdrop-filter` / overflow when still inside the toolbar
- Typing in table cells; column resize; image resize box
- PDF table row gaps

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

[1.0.0-beta.0]: https://github.com/velo-text/velo-text/releases/tag/v1.0.0-beta.0
[0.1.0]: https://github.com/velo-text/velo-text/releases/tag/v0.1.0
[1.0.0-beta.1]: https://github.com/velo-text/velo-text/releases/tag/v1.0.0-beta.1
[1.0.0-beta.2]: https://github.com/velo-text/velo-text/releases/tag/v1.0.0-beta.2
[1.0.0-beta.3]: https://github.com/velo-text/velo-text/releases/tag/v1.0.0-beta.3
[1.0.0-beta.4]: https://github.com/velo-text/velo-text/releases/tag/v1.0.0-beta.4
[1.0.0-beta.5]: https://github.com/velo-text/velo-text/releases/tag/v1.0.0-beta.5
[1.0.0-beta.6]: https://github.com/velo-text/velo-text/releases/tag/v1.0.0-beta.6
[1.0.0-beta.7]: https://github.com/velo-text/velo-text/releases/tag/v1.0.0-beta.7
[1.0.0-beta.8]: https://github.com/velo-text/velo-text/releases/tag/v1.0.0-beta.8
