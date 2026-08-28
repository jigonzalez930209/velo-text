# Performance

Budgets in `docs/perf-budgets.md`:

- Visible write (50 pages) <16 ms
- Paste 1 MB <1 s
- Incremental save <50 ms
- Export 100 pages <5 s with progress & cancel
- Memory no growth after open/close cycles

Run `pnpm run benchmark` → `tests/perf/baselines.json`. Macro budgets in `docs/perf-budgets.md` are targets until the harness records them.

Layout and export are deterministic with injected `Clock`/`IdGenerator` for tests.

See `scripts/benchmark.js`, `src/export/layout/*`, `src/core/schema/canonical.ts`.
