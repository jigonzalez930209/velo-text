# Performance Budgets — Phase 12.2.1

Measured on reference hardware (GitHub Actions `ubuntu-latest`, Node 22). Baselines versioned in `tests/perf/baselines.json`.

| Operation | Budget | Current | Notes |
|---|---|---|---|
| Visible typing (50 pages) | <16 ms per op | ~2 ms | `src/core/operations/operations.ts:1` |
| Paste 1 MB | <1 s | ~400 ms | `src/editor-web/clipboard/index.ts:12` |
| Incremental save (normalize + validate) | <50 ms | ~15 ms | `src/core/normalize/normalize.ts:1` |
| Export 100 pages PDF | <5 s, progress observable, cancellable | ~2.1 s STORE | `src/export/pdf/writer.ts:1` |
| Canonical hash (10k nodes) | <20 ms | ~8 ms | `src/core/schema/canonical.ts:1` |
| Layout pagination (50 pages) | <100 ms | ~45 ms | `src/export/layout/pagination.ts:1` |
| Memory after open/close cycles | no growth | stable | Check via `node --expose-gc` |

## Regression thresholds
- Fail CI if any budget regresses >20% vs baseline.
- Track `dist/` bundle size (ESM) — currently ~45 KB gzipped.

## How to run
```bash
pnpm run build
node scripts/benchmark.js
```
