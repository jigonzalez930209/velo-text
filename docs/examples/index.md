---
outline: false
---

<script setup>
import ExamplesPlayground from "../.vitepress/theme/ExamplesPlayground.vue";
</script>

# Framework examples

Copy-paste hosts for `mountVanillaEditor` from **velo-text**. The core package does not depend on React, Vue, Svelte, Angular, or Astro.

<ClientOnly>
  <ExamplesPlayground />
</ClientOnly>

| Host | Adapter | App |
| --- | --- | --- |
| [Vanilla](/examples/vanilla) | `examples/vanilla/index.html` | same |
| [React](/examples/react) | `examples/react/PortableEditor.jsx` | `App.jsx` |
| [Vue](/examples/vue) | `examples/vue/PortableEditor.vue` | `App.vue` |
| [Svelte](/examples/svelte) | `examples/svelte/portableEditor.js` | `App.svelte` |
| [Angular](/examples/angular) | `examples/angular/portable-editor.ts` | `app.component.ts` |
| [Astro](/examples/astro) | `examples/astro/PortableEditor.astro` | `index.astro` |

Backend fill (same JSON for Vite, Express, Vercel): [backend examples](/examples/backend).
