# Editor

## Renderer
- Host `contenteditable` controlled, each DOM node has `data-node-id`/`data-node-type`, reconciliation by IDs.
- `reconcileDom(prev,next,container)` does minimal patch (MVP full re-render but preserves IME composition).
- `MutationObserver` detects external mutations (extensions, autocorrect) and triggers recovery.
- Variables/equations are `contenteditable=false`, keyboard navigable, `role="math"` or `role="button"`.

## Input pipeline
Typing stays in the browser (`contenteditable`). `createEditor` attaches `attachInputPipeline` with `nativeTyping: true` so insert/delete/enter are not `preventDefault`'d. Shortcuts (`Mod+b`, undo/redo) still go through `onIntent`. Paste is intercepted: `handlePaste` allowlists HTML, then `insertHTML`/`insertText`. Undo uses `History` (snapshot + typing coalesce). AST sync is `input` → `domToAst` → `normalizeDocument`.

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
Marks use `execCommand` when available and then `syncFromDom`. Alignment writes `text-align` on the **innermost paragraph** (including paragraphs inside table cells), then parses it back into `ParagraphNode.align`. If an image is selected (resize overlay visible), the same toolbar buttons set `ImageBlockNode.align` (`left` / `center` / `right`; justify is ignored).

## Images
- Insert via `insertImage(assetId, widthUm?, heightUm?)` or the playground file picker (`resolveAssetUrl` for blob URLs).
- Click the figure to show the **resize overlay** on the `<img>` (not the full-width figure). Drag keeps aspect ratio and writes `widthUm` / `heightUm`.
- Align with the paragraph toolbar after selecting the image. The figure is `display:block; width:100%` so `text-align` positions the bitmap.
- Nested: an image may live in a table cell or column slot (max nesting depth 3 for `table`/`columns`).

## Tables
- Click a table to show **column/row resize handles** and a **table bar** (same idea as the text selection bubble), **3px above** the table top edge and always **below** the sticky formatting toolbar.
- The bar shows the **active cell** (`R2C1`) and insert/delete row or column, merge/split, density, look, presets, shade, and delete table. Drag across cells to select a rectangle; drag along the header row to select **columns**, or along the first column to select **rows**.
- Cell text is a nested `paragraph`. The table bar **Cell alignment** menu sets horizontal (left/center/right) and **vertical** (top/middle/bottom) on the selected cells. Custom layout uses the **same bar** (3px above, below the sticky toolbar) and the same **Cell alignment** menu on the focused column slot.
- Table look (header, bands, accent) uses **theme tokens**, so dark and light presets stay readable.
- `Tab` / `Shift+Tab` via `handleTableTab` (wraps, creates a row at the end). Spans: `setCellSpan`. Structural ops: `insertRowAfter`, `deleteRow`, `insertColumnAfter`, `deleteColumn`.

## Columns
Block type `columns` (`createColumns(idGen, count | pcts)`). Click a column slot to show a **layout bar** like the table bar (slot `C1`, Cell alignment, width presets, insert, delete). Drag across slots to select several. Vertical default is **middle**, same as table cells. Width presets stay additive.

Insert **table**, **image**, or **nested columns** into the focused cell or slot (toolbar or `+` handle). Combinations (table in a column, image in a cell, columns in a cell, …) are allowed up to **depth 3** of nested `table`/`columns`.

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

See `src/editor-web/controller` and `src/editor-web/ux` (command palette, selection bubble, find, image drop, page preview).

## Usability

The playground and `createEditor` host share this chrome. None of it lives in core.

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd+Shift+P` | Command palette |
| `/` in empty paragraph | Same catalogue, anchored to caret |
| `Ctrl/Cmd+F` / `H` | Find / replace (text nodes; skips variables and raw LaTeX) |
| `?` | Shortcut sheet |
| `Mod+b` / `i` / `u` | Marks (also selection bubble) |
| `Tab` / `Shift+Tab` | Next/previous table cell |

- Selection bubble: bold/italic/underline/link/clear. Table and column chrome stay on the block.
- Click `{{path}}` to edit path / format / fallback. Links: `https:`, `mailto:`, `#` only.
- Drop PNG/JPEG/WebP/SVG onto the editor (`onImageFile` on the host).
- Outline: `getOutline()` / `focusBlock(id)`. Page chrome: `setPagePreview(true)` uses the same `pdfPageMetrics` / `buildPdfPages` as the writer (paper size + page count). **PDF bytes** always come from `previewPdf` / `exportPdf` — same function as the HTTP API.
- Preview panel materializes with the same resolver as export.
- IME: `_pdeComposing` — do not sync AST mid-composition.

