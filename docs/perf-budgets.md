# Performance Budgets — Phase 12.2.1

Measured on local Node (see `tests/perf/baselines.json`). Macro budgets below are **targets**, not CI gates until the benchmark harness records them.

| Operation | Budget | Baseline in repo | Notes |
|---|---|---|---|
| `insertInline` | — | ~0.01 ms/op | `scripts/benchmark.js` |
| `canonicalStringify` (50-page fixture scale) | — | ~0.05 ms/op | `scripts/benchmark.js` |
| Visible typing (50 pages) | <16 ms per op | not measured in CI | target |
| Paste 1 MB | <1 s | not measured in CI | target |
| Export 100 pages PDF | <5 s | not measured in CI | target |

## Regression thresholds
- Fail CI if recorded `tests/perf/baselines.json` ops regress >20% (when `pnpm run benchmark` is wired to compare).
- `dist/` size is not gzip-gated yet.

## How to run
```bash
pnpm run build
node scripts/benchmark.js
```
