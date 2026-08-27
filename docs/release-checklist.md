# Release Checklist — Phase 12.2.3 (Release Candidate)

- [ ] `pnpm run check:types` passes (strict)
- [ ] `pnpm run check:zero-deps` passes
- [ ] `pnpm run lint` passes (core isolation)
- [ ] `pnpm run build` produces deterministic `dist/` (hash stable with fixed clock)
- [ ] `pnpm run test` all 44+ tests pass, including fixtures 33/33 and smoke export
- [ ] `scripts/validate-fixtures.ts` passes for all schema versions (v1 currently, keep fixtures for v0 if existed)
- [ ] `scripts/smoke-export.ts` produces PDF/ODT/DOCX with correct magic bytes and deterministic output
- [ ] Open and re-save in LibreOffice, Microsoft Word, and PDF viewer (manual)
- [ ] No "Word found unreadable content" warning (blocks release if appears)
- [ ] Visual snapshots for toolbar, document, tables, variables, images, equations (see `tests/visual`)
- [ ] Security corpus and fuzzing (`scripts/fuzz.js --seed=42 --iterations=10000`) passes without crash
- [ ] Performance budgets checked (`docs/perf-budgets.md`)
- [ ] `docs/api-report.md` regenerated (`node scripts/generate-api-report.js`) and reviewed for semver
- [ ] `migrations/` applied on staging PG and downgrade tested if needed
- [ ] `CHANGELOG.md` updated, version bumped per semver
- [ ] Tag `vX.Y.Z` and GitHub release with `dist/` tarball

## Sign-off
- [ ] Two screen readers tested (VoiceOver, NVDA) for toolbar and atomic nodes
- [ ] Contrast checked for all 4 themes (see `src/theme/index.ts`)
- [ ] Backup and restore tested on staging
