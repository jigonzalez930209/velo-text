# Editor Web

`src/editor-web/controller/index.ts` — `createEditor(container, opts)` → `{ getDocument, setDocument, setTheme, undo/redo, commands, destroy }`. Commands: `toggleMark`, `setHeading`, `setAlign` (paragraphs, cells, **selected image**), `insertTable`, `insertColumns`, `insertVariable`, `insertEquation`, `insertImage`, `insertBlock`, `deleteCurrentBlock`.

`src/editor-web/controller/table-ui.ts` + `table-resize.ts` — table chrome (menu button beside the table), column width drag (`widthUm`), row height drag (`heightUm`).

`src/editor-web/controller/image-resize.ts` — overlay on the `<img>` box; `setAlign` prefers the figure with an open overlay.

`src/editor-web/view/index.ts` — `renderDocumentToHtml`, `renderBlocksToHtml`, `reconcileDom`, `attachMutationObserver`, `buildNodeMap`, `domSelectionToLogical`/`logicalToDomSelection` (atomic `variable`/`equation`). Paragraphs emit `style="text-align:…"`. Image figures emit the same when `align` is center/right. Tables emit `col` + `data-col-id` / `data-col-width-um` and `tr` `data-height-um`.

`src/editor-web/input/index.ts` — `InputIntent`, `defaultShortcuts`, `eventToShortcut`, `beforeInputToIntent`, `intentToOperation`, `attachInputPipeline` (IME, `compositionstart/end`).

`src/editor-web/tables/index.ts` — `insertRowAfter`, `deleteRow`, `insertColumnAfter`, `deleteColumn`, `getNextCell`, `handleTableTab`, `createCellSelection`, `setCellSpan`.

`src/editor-web/clipboard/index.ts` — `handlePaste`, `sanitizePastedHtml` (allowlist via `DOMParser`), `handleImageFiles`, `PASTE_LIMIT_BYTES`, `createInternalFragment`.

`src/editor-web/images/index.ts` — `validateImageBytes` (sniff + dimensions).

`src/editor-web/toolbar/index.ts` — `registerCommand`, `getCommand`, `CommandDef {id,label,icon,canExecute,execute}` with 28 icons.

`src/editor-web/accessibility/index.ts` — `announce`, `makeToolbarNavigable`, `trapFreeNavigation`, `checkContrast`, `validateImageAlt`.

See `examples/vanilla/index.html`, `docs/guide/adapters.md`, and the in-docs [Playground](/playground/).
