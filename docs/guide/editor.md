# Editor

## Renderer
- Host `contenteditable` controlled, each DOM node has `data-node-id`/`data-node-type`, reconciliation by IDs.
- `reconcileDom(prev,next,container)` does minimal patch (MVP full re-render but preserves IME composition).
- `MutationObserver` detects external mutations (extensions, autocorrect) and triggers recovery.
- Variables/equations are `contenteditable=false`, keyboard navigable, `role="math"` or `role="button"`.

## Input pipeline
```
beforeinput / keydown / paste / drop
  → normalize event → intent → operation → validate → transaction → normalize AST → reconcile → restore selection → emit change
```
- `beforeinput` is primary; `keydown` is fallback (documented).
- Shortcuts configurable via `defaultShortcuts` (`Mod+b`, etc.) — see `src/editor-web/input/index.ts`.
- IME: `compositionstart`/`compositionend` defer reconciliation.
- Mobile & autocorrect handled via same pipeline.

## Commands
```ts
editor.execute("text.toggleBold");
editor.execute("table.insertRowAfter");
editor.execute("variable.insert", { path: "customer.name" });
editor.execute("equation.insert", { latex: "\\frac{a}{b}" });
editor.execute("image.insert", { assetId: "ast_123" });
```
Each has `canExecute`, `execute`, validated payload and invertible change.

## Tables
Insert/delete rows/columns, spans, `Tab`/`Shift+Tab` navigation (wraps, creates row at end), cell selection (`createCellSelection`, `extendCellSelection`).

## Clipboard & DnD
- `text/plain` → paragraphs/hard-breaks
- `text/html` → `DOMParser` + allowlist (`p,h1,ul,...`), strips `script`, `javascript:` etc.
- Images: magic-signature validation before registering asset
- Limits: 1 MB paste, 500k chars
- Internal fragment `application/x-pde-fragment` for lossless copy between editors

## Accessibility
- Toolbar `role="toolbar"` with arrow-key navigation, `aria-pressed` for marks
- Correct ARIA roles, visible labels, `aria-live` announcements (`announce()`)
- High contrast in 4 themes, `checkContrast` WCAG AA
- Alt text required (decorative allowed empty), trap-free navigation for atomic nodes

See `src/editor-web/view|input|clipboard|tables|images|accessibility`.
