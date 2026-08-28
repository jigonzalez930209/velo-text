# Framework adapters

The editor DOM is always `contenteditable` from `createEditor` / `mountVanillaEditor`. Do **not** reimplement the reconciler in React/Vue VDOM. Framework adapters are **host code**: they live in `examples/` and depend on the framework + this library. The core package has **zero** React/Vue/etc. dependencies.

```ts
import { mountVanillaEditor } from "velo-text";
// or: velo-text/vanilla

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

CSS from the package: `import "velo-text/themes/base.css"` and `import "velo-text/themes/components.css"`. Theme via `data-pde-theme` (`light-neutral` | `light-warm` | `dark-slate` | `dark-contrast`).

The editor is **client-only**. Astro/SSR should emit `renderDocumentToHtml` at build time and hydrate the editor in an island (`client:load`).

Interactive demo: [Playground](/playground/). Full copy-paste pages: [Examples](/examples/).

| Host | Adapter | App sample |
| --- | --- | --- |
| Vanilla | `examples/vanilla/index.html` | same file |
| React | `examples/react/PortableEditor.jsx` | `examples/react/App.jsx` |
| Vue | `examples/vue/PortableEditor.vue` | `examples/vue/App.vue` |
| Svelte | `examples/svelte/portableEditor.js` | `examples/svelte/App.svelte` |
| Angular | `examples/angular/portable-editor.ts` | `examples/angular/app.component.ts` |
| Astro | `examples/astro/PortableEditor.astro` | `examples/astro/index.astro` |

Each sample: mount → `insertVariable` → `exportDocument` (`pdf` / `odt` / `docx`).

## Vanilla

Official API. Own the host element; call `destroy()` on unmount.

<<< @/../examples/vanilla/index.html

## React

`useRef` + `useEffect` cleanup. React must **not** reconcile children of the host.

<<< @/../examples/react/PortableEditor.jsx

App (variable + PDF/ODT/DOCX):

<<< @/../examples/react/App.jsx

## Vue

`v-model:document` via `update:document`. Expose `insertVariable` / `getDocument`.

<<< @/../examples/vue/PortableEditor.vue

<<< @/../examples/vue/App.vue

## Svelte

Action `use:portableEditor={opts}`. `update` pushes `setDocument` / `setTheme`.

<<< @/../examples/svelte/portableEditor.js

<<< @/../examples/svelte/App.svelte

## Angular

Standalone directive on the host element. `ViewChild` for `insertVariable`.

<<< @/../examples/angular/portable-editor.ts

<<< @/../examples/angular/app.component.ts

## Astro

Do not SSR the editor. Static HTML uses `renderDocumentToHtml`; the editor is a `client:load` island (React wrapper here; any client framework works).

<<< @/../examples/astro/PortableEditor.astro

<<< @/../examples/astro/index.astro
