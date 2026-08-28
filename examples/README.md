# Adapters

Vanilla official API: `mountVanillaEditor(el, opts)` (same as `createEditor`).

The editor is always a **client** `contenteditable` host. Framework files in this folder are copy-paste adapters — they are **not** published as npm packages and must not be imported from the core.

| Host | Adapter | Sample app |
| --- | --- | --- |
| Vanilla | `examples/vanilla/index.html` | same |
| React | `examples/react/PortableEditor.jsx` | `examples/react/App.jsx` |
| Vue | `examples/vue/PortableEditor.vue` | `examples/vue/App.vue` |
| Svelte | `examples/svelte/portableEditor.js` | `examples/svelte/App.svelte` |
| Angular | `examples/angular/portable-editor.ts` | `examples/angular/app.component.ts` |
| Astro | `examples/astro/PortableEditor.astro` | `examples/astro/index.astro` |

Each sample: mount → `insertVariable` → `exportDocument` (`pdf` / `odt` / `docx`).

Import CSS `themes/base.css` + `themes/components.css`. Zero extra runtime deps in the core package; frameworks are **peer** dependencies of the host app.

Interactive demo is in the VitePress docs: `pnpm docs:dev` → [/playground/](../docs/playground/).

Backend / storage: `backend.mjs`, `postgres.mjs`, `s3.mjs`, `http-api.mjs`.
Tag fill → PDF: `examples/backend/` (Vite plugin, Express, Vercel) — live tabs at docs `/examples/`.
