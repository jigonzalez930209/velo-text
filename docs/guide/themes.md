# Themes

Tokens only — no literals outside theme files.

```css
.pde-root {
  --pde-color-bg: #ffffff;
  --pde-color-surface: #f7f8fa;
  --pde-color-text: #17191c;
  --pde-color-variable-bg: #e8efff;
  --pde-radius-md: 8px;
  --pde-font-ui: system-ui, sans-serif;
}
```

Four presets in `src/theme/index.ts`:
- `light-neutral` (default), `light-warm`, `dark-slate`, `dark-contrast`

Each is ` [data-pde-theme="..."]` assignment. Consumers can override one or all.

Icons use `currentColor` → `var(--pde-icon-color, currentColor)`. Chrome size is `--pde-icon-size` (default `16px`, same as typical app sidebars) and `--pde-control-size` (hit target, default `28px`). Override on the host:

```css
.pde-host, [data-pde-theme] {
  --pde-icon-size: 1rem;
  --pde-control-size: 1.75rem;
}
```

Do not add a second size API on `createEditor` — CSS tokens are the contract.

Equation style via `src/core/equation/index.ts:equationCss` (frac, sqrt).

All colors/dimensions configurable with CSS properties.

Visual snapshots per theme in `tests/visual/snapshots/` — CI compares hashes.

See `themes/base.css`, `themes/components.css`, `src/theme/`.
