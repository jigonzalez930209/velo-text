# Performance

Numeric targets: [Performance budgets](/perf-budgets).

- Visible write (50 pages) < 16 ms
- Paste 1 MB < 1 s
- Incremental save < 50 ms
- Export 100 pages < 5 s with progress and cancel
- No retained growth after open/close cycles

`pnpm run benchmark` writes `tests/perf/baselines.json`. Macro numbers in the budget doc are **targets** until the harness records them.

Layout and export are deterministic when `Clock` and `IdGenerator` are injected.

See `scripts/benchmark.js`, `src/export/layout/*`, `src/core/schema/canonical.ts`.
