# Release checklist

v1 product export is **PDF, ODT, and DOCX** via `exportDocument`. LibreOffice/Word round-trip is still not a CI gate ([Roadmap](/guide/roadmap)).

- [ ] `pnpm run check:types` passes (strict)
- [ ] `pnpm run check:zero-deps` passes
- [ ] `pnpm run lint` passes (core isolation)
- [ ] `pnpm run build` produces deterministic `dist/` (hash stable with fixed clock)
- [ ] `pnpm run test` unit + conformance + integration + `test:security`
- [ ] `pnpm run test:visual` and `tests/visual/snapshots` committed
- [ ] `scripts/validate-fixtures.ts` passes for all schema versions
- [ ] `scripts/smoke-export.ts` produces valid **PDF/ODT/DOCX** (magic bytes, deterministic with fixed clock)
- [ ] Open the playground PDF in a viewer: tables are contiguous; images align; PNG downscale when resized down
- [ ] Playground ODT/DOCX download; HTTP `?format=odt|docx`
- [ ] Visual snapshots for toolbar, document, tables, variables, images, equations (see `tests/visual`)
- [ ] Security corpus and fuzzing (`scripts/fuzz.js --seed=42 --iterations=10000`) passes without crash
- [ ] Performance budgets checked (`docs/perf-budgets.md`)
- [ ] `docs/api-report.md` regenerated (`node scripts/generate-api-report.js`) and reviewed for semver
- [ ] `migrations/` applied on staging PG and downgrade tested if needed
- [ ] `CHANGELOG.md` updated, version bumped per semver (`1.0.0-beta.8` for this trial)
- [ ] GitHub secret **`NPM_TOKEN`** set (never in git)
- [ ] Push git tag `vX.Y.Z` (must match `package.json` version) → workflow **Publish npm**
- [ ] Confirm npm `velo-text@beta` (or `@latest`) and the GitHub Release

## Remaining Office checks
- [ ] Open and re-save in LibreOffice and Microsoft Word
- [ ] No "Word found unreadable content"

## Sign-off
- [ ] Two screen readers tested (VoiceOver, NVDA) for toolbar and atomic nodes
- [ ] Contrast checked for all 4 themes (see `src/theme/index.ts`)
- [ ] Backup and restore tested on staging
