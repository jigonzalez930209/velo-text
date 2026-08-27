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

## Host (`createEditor`)
`src/editor-web/controller/index.ts` mounts a `contenteditable` host inside `.pde-editor-wrapper`. Overlays (block handles, table chrome, image resize) live in a sibling `.pde-ui-layer` so they do not steal typing.

```ts
const editor = createEditor(container, {
  document,
  theme: "light-neutral",
  resolveAssetUrl: (id) => urls[id],
  onChange: (doc) => { /* persist AST */ },
});
editor.commands.setAlign("center");
editor.commands.insertTable(2, 2);
editor.commands.insertColumns(2);
```

Toolbar buttons should `preventDefault` on `mousedown` so the caret in a cell is not lost.

## Commands
```ts
editor.commands.toggleMark("bold");
editor.commands.setAlign("left" | "center" | "right" | "justify");
editor.commands.insertTable(2, 2);
editor.commands.insertColumns(2);
editor.commands.insertVariable("customer.name");
editor.commands.insertEquation("\\frac{a}{b}");
editor.commands.insertImage(assetId);
```
Marks use `execCommand` when available and then `syncFromDom`. Alignment writes `text-align` on the **innermost paragraph** (including paragraphs inside table cells), then parses it back into `ParagraphNode.align`.

## Tables
- Click a table to show **column handles** (vertical, drag width → `columns[].widthUm`) and **row handles** (horizontal, drag height → `rows[].heightUm`).
- A small **table button** to the right of the table opens insert/delete row/column and delete table. The menu sits **beside** the table so cells stay editable.
- Cell text is a nested `paragraph` (and optional other blocks). Type normally; alignment from the toolbar applies to the cell paragraph, not the outer `<table>`.
- `Tab` / `Shift+Tab` via `handleTableTab` (wraps, creates a row at the end). Spans: `setCellSpan`. Structural ops: `insertRowAfter`, `deleteRow`, `insertColumnAfter`, `deleteColumn`.

## Columns
Block type `columns` (`createColumns(idGen, n)`): side-by-side slots, each with nested blocks. Rendered as `.pde-columns` / `.pde-column`. Exported as a table-like grid in PDF/DOCX/ODT.

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

See `src/editor-web/controller` (commands, handles, table-ui, table-resize, image-resize), `view`, `input`, `clipboard`, `tables`, `images`, `accessibility`.
