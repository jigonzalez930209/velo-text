# Themes

Tokens only — no color literals outside theme CSS.

```css
.pde-root {
  --pde-color-bg: #ffffff;
  --pde-color-primary: /* override */;
  --pde-icon-color: currentColor;
}
```

Presets (`src/theme/index.ts`), attribute `data-pde-theme`:

- `light-neutral` (default)
- `light-warm`
- `dark-slate`
- `dark-contrast`

```ts
import { themes, themeCss, allThemesCss } from "velo-text";
```

Files: `themes/base.css`, `themes/components.css`. Icons via `currentColor`. Equations: `equationCss`. High-contrast / WCAG AA for the four presets (`checkContrast`).
