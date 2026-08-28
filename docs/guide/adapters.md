# Framework adapters

The editor DOM is always `contenteditable` from `createEditor` / `mountVanillaEditor`. Do **not** reimplement the reconciler in React/Vue VDOM.

```ts
import { mountVanillaEditor } from "portable-doc-editor";
// or: portable-doc-editor/vanilla

const editor = mountVanillaEditor(el, {
  document,
  theme: "light-neutral",
  editable: true,
  onChange: (doc) => { /* debounce persist */ },
  resolveAssetUrl: (id) => urls[id],
});
editor.commands.insertVariable("name");
editor.destroy(); // removes .pde-editor-wrapper
```

CSS: `themes/base.css` + `themes/components.css`. Theme via `data-pde-theme` (`light-neutral` | `light-warm` | `dark-slate` | `dark-contrast`).

Usability built into the host: `Ctrl/Cmd+K` palette, `/` slash menu, selection bubble, `Ctrl/Cmd+F` find, image drop, `?` shortcuts, `openFind` / `setPagePreview` / `getOutline`.

The editor is **client-only**. Astro/SSR should emit `renderDocumentToHtml` at build time and hydrate the editor in an island (`client:load`).

Examples: `examples/vanilla/`, `examples/react/`, `examples/vue/`, `examples/svelte/`, `examples/angular/`, `examples/astro/`.
