# Adapters

Vanilla official API: `mountVanillaEditor(el, opts)` (same as `createEditor`).

| Host | File |
| --- | --- |
| Vanilla | `examples/vanilla/index.html` |
| React | `examples/react/PortableEditor.jsx` (`useRef` + `useEffect` cleanup) |
| Vue | `examples/vue/PortableEditor.vue` (`v-model` via `update:document`) |
| Svelte | `examples/svelte/portableEditor.js` (action) |
| Angular | `examples/angular/portable-editor.ts` (standalone directive) |
| Astro | `examples/astro/PortableEditor.astro` (`client:load`, no SSR of the editor) |

Each example: mount → `insertVariable` → `exportDocument` (`pdf` / `odt` / `docx`).

Import CSS `themes/base.css` + `themes/components.css`. Zero extra runtime deps in the core package; frameworks are **peer** dependencies of the host app.
