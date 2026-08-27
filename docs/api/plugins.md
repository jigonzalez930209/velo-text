# Plugins

See `docs/guide/plugins.md` for philosophy.

Interface in `src/core/plugin/index.ts` (new):
- Internal: `src/core/equation` (example)
- External: `registerPlugin(def)` validates `schema`, `version`, `migrate`, provides `renderWeb`, `renderPdf/Odt/Docx`, `commands`.

All plugins declare `type`, `version`, `schema`, `normalize`, `commands`, `formatters`, `migrate`, and are tested via contract tests (`tests/plugin/`).

See `src/public-api/index.ts` (`registerPlugin`) and `docs/guide/plugins.md`.
