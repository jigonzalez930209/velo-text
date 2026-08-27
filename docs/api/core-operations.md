# Core — Operations & History

`src/core/operations/operations.ts` — `createTransaction(doc,intent)` with `insertBlock/deleteBlock`, `insertInline/deleteInline`, `applyMarks`, `commit()` → `{document, ops, inverses, intent}`.

`src/core/selection/selection.ts` — `createCollapsedSelection`, `createRangeSelection`, `isCollapsed`, `mapSelectionThroughOps`.

`src/core/history/history.ts` — `History` with coalescing by time/intent, checkpoints, limit, `undo`/`redo`.

`src/core/events/index.ts` — `EventEmitter` (`beforeChange`/`afterChange`).

See `tests/unit/validator.test.js`, `history` usage in editor.
