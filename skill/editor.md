# Editor web

Client-only. Host owns an empty element. Official mount: `mountVanillaEditor` (`velo-text` or `velo-text/vanilla`). Same internals as `createEditor`.

```ts
import "velo-text/themes/base.css";
import "velo-text/themes/components.css";
import { createDocument, createIdGenerator, mountVanillaEditor } from "velo-text";

const editor = mountVanillaEditor(hostEl, {
  document: doc,
  theme: "light-neutral", // light-warm | dark-slate | dark-contrast
  editable: true,
  idGenerator, clock,
  onChange: (doc) => { /* debounce persist AST */ },
  resolveAssetUrl: (id) => urls[id],
  onImageFile: async (file) => ({ assetId }),
  getVariableCatalog: () => ["customer.name"],
  getTemplateData: () => ({}),
});
```

Handle: `getDocument`, `setDocument`, `setTheme`/`getTheme`, `undo`/`redo`/`canUndo`/`canRedo`, `commands`, `openCommandPalette`, `openFind(replace?)`, `openShortcuts`, `openEquationEditor`, `setPagePreview(on)`, `getOutline`, `focusBlock(id)`, `destroy`.

**Do not** put children or `innerHTML` in the host after mount. React/Vue must not reconcile inside it. `destroy()` removes `.pde-editor-wrapper`.

SSR/Astro: `renderDocumentToHtml` / `renderBlocksToHtml` at build; hydrate editor in an island (`client:load`).

## Commands

`toggleMark`, `setHeading(level | null)`, `toggleList("ordered"|"unordered")`, `toggleQuote`, `setAlign("left"|"center"|"right"|"justify")` (images: L/C/R only), `clearFormat`, `insertVariable(path, format?, fallback?)`, `insertEquation(latex, display?)`, `insertImage(assetId, widthUm?, heightUm?)`, `insertTable(rows, cols)`, `insertColumns(count | pcts)`, `insertColumnMosaic(counts)`, `insertBlock(type)`, `deleteCurrentBlock`, `setColor`, `setHighlight`, `setFontFamily`, `setFontSizePt`, `indent(delta?)`, `insertLink(href)` (`https:`, `mailto:`, `#` only).

`insertBlock` types: paragraph, heading1–3, quote, listUnordered/Ordered, table, equationBlock, pageBreak, horizontalRule, columns.

Document fonts: `DOCUMENT_FONTS` (`Velo Sans`, `Velo Serif`, `Velo Mono`, `Velo Display`). `setFontFamily` writes those names; PDF embeds the same TTF.

Toolbar buttons: `preventDefault` on `mousedown` (keep caret, including in cells).

## DOM / input

- Host `contenteditable`; nodes have `data-node-id` / `data-node-type`. `reconcileDom` patches; IME uses `_pdeComposing` (do not sync mid-composition).
- Typing stays native (`nativeTyping`). Shortcuts (`Mod+b`, undo) via `onIntent`. Paste: `handlePaste` allowlist then insert. Sync: `input` → `domToAst` → `normalizeDocument`.
- Overlays live in sibling `.pde-ui-layer` (handles, table/column bars, image resize).
- Tables: Tab/Shift+Tab wrap; resize col/row; merge/split; cell h/v align; look tokens. Columns: slot bar, width presets additive.
- Images: click figure → resize overlay on `<img>` (aspect lock → `widthUm`/`heightUm`). Drop PNG/JPEG/WebP/SVG via `onImageFile`.
- Clipboard: `text/plain`, HTML allowlist, 1 MB / 500k chars; internal `application/x-pde-fragment`.
- UX: `Ctrl/Cmd+Shift+P` or `/` in empty p → palette; `Ctrl/Cmd+F`/`H` find/replace (skips variables/raw LaTeX); `?` shortcuts; selection bubble outside tables.

Also exported: `registerCommand`/`getCommand`/`listCommands`, `makeToolbarNavigable`, `intentToOperation`, `collectOutline`, `findTextHits`, `replaceTextInDocument`, `COLUMN_PRESETS`, `openSizePicker`, `openMosaicPicker`, `clampTableSize`, `placeOverlay`.

## Framework hosts

Peer frameworks in the **app**. Samples: repo `examples/`.

**React** — `useRef` + `useEffect` cleanup; no children on host. See `examples/react/PortableEditor.jsx`.

**Vue** — `v-model:document` via `update:document`. `examples/vue/PortableEditor.vue`.

**Svelte** — `use:portableEditor={opts}`; `update` → `setDocument`/`setTheme`. `examples/svelte/portableEditor.js`.

**Angular** — standalone directive. `examples/angular/portable-editor.ts`.

**Astro** — no SSR editor; island + `renderDocumentToHtml`. `examples/astro/`.
