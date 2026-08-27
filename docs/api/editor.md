# Editor Web

`src/editor-web/view/index.ts` — `renderDocumentToHtml`, `reconcileDom`, `attachMutationObserver`, `buildNodeMap`, `domSelectionToLogical`/`logicalToDomSelection` (atomic `variable`/`equation`).

`src/editor-web/input/index.ts` — `InputIntent`, `defaultShortcuts`, `eventToShortcut`, `beforeInputToIntent`, `intentToOperation`, `attachInputPipeline` (IME, `compositionstart/end`).

`src/editor-web/tables/index.ts` — `insertRowAfter`, `deleteRow`, `insertColumnAfter`, `deleteColumn`, `getNextCell`, `handleTableTab`, `createCellSelection`, `setCellSpan`.

`src/editor-web/clipboard/index.ts` — `handlePaste`, `sanitizePastedHtml` (allowlist via `DOMParser`), `handleImageFiles`, `PASTE_LIMIT_BYTES`, `createInternalFragment`.

`src/editor-web/images/index.ts` — `validateImageBytes` (sniff + dimensions).

`src/editor-web/toolbar/index.ts` — `registerCommand`, `getCommand`, `CommandDef {id,label,icon,canExecute,execute}` with 28 icons.

`src/editor-web/accessibility/index.ts` — `announce`, `makeToolbarNavigable`, `trapFreeNavigation`, `checkContrast`, `validateImageAlt`.

See `examples/vanilla-web.html` and playground.
