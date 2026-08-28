import { defineConfig } from "vitepress";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docsDir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(docsDir, "../..");
const src = path.join(repo, "src");
const base = process.env.DOCS_BASE || "/";

export default defineConfig({
  title: "velo-text",
  description: "velo-text — zero_deps document editor, TypeScript strict, PDF",
  lang: "en-US",
  base,
  head: [
    ["link", { rel: "icon", href: `${base}favicon.svg`.replace("//", "/") }],
    ["meta", { name: "theme-color", content: "#3659e3" }],
  ],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/introduction" },
      { text: "API", link: "/api/overview" },
      { text: "Playground", link: "/playground/" },
      { text: "Examples", link: "/examples/" },
      { text: "Changelog", link: "/changelog" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Introduction", link: "/guide/introduction" },
            { text: "Architecture", link: "/guide/architecture" },
            { text: "Data Model", link: "/guide/model" },
            { text: "Editor", link: "/guide/editor" },
            { text: "Adapters", link: "/guide/adapters" },
            { text: "Template Engine", link: "/guide/template" },
            { text: "Assets & S3", link: "/guide/assets" },
            { text: "Layout", link: "/guide/layout" },
            { text: "Export (PDF)", link: "/guide/export" },
            { text: "Themes", link: "/guide/themes" },
            { text: "Plugins", link: "/guide/plugins" },
            { text: "PostgreSQL", link: "/guide/postgres" },
            { text: "Security", link: "/guide/security" },
            { text: "Performance", link: "/guide/performance" },
            { text: "Publish to npm", link: "/guide/publish" },
          ],
        },
      ],
      "/examples/": [
        {
          text: "Framework adapters",
          items: [
            { text: "Overview", link: "/examples/" },
            { text: "Vanilla", link: "/examples/vanilla" },
            { text: "React", link: "/examples/react" },
            { text: "Vue", link: "/examples/vue" },
            { text: "Svelte", link: "/examples/svelte" },
            { text: "Angular", link: "/examples/angular" },
            { text: "Astro", link: "/examples/astro" },
            { text: "Backend PDF (Vite / Express / Vercel)", link: "/examples/backend" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API",
          items: [
            { text: "Overview", link: "/api/overview" },
            { text: "Core — Model", link: "/api/core-model" },
            { text: "Core — Schema & Canonical", link: "/api/core-schema" },
            { text: "Core — Operations & History", link: "/api/core-operations" },
            { text: "Template — Parser & Resolver", link: "/api/template" },
            { text: "Equation", link: "/api/equation" },
            { text: "Editor Web", link: "/api/editor" },
            { text: "Assets (Sniff, Dimensions, Hash, SVG, Icons, Store)", link: "/api/assets" },
            { text: "Export — Writers & Validate", link: "/api/export" },
            { text: "Layout", link: "/api/layout" },
            { text: "Theme", link: "/api/theme" },
            { text: "Adapters (PG & S3)", link: "/api/adapters" },
            { text: "Public API", link: "/api/public" },
            { text: "Plugins", link: "/api/plugins" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: "https://github.com/velo-text/velo-text" }],
    footer: {
      message: "Zero runtime dependencies — TypeScript strict — MIT",
      copyright: "Copyright © 2026 velo-text",
    },
    search: { provider: "local" },
  },
  vite: {
    server: {
      port: 5174,
      fs: { allow: [repo] },
    },
    resolve: {
      alias: [
        { find: "velo-text/backend", replacement: path.join(src, "adapters/backend/index.ts") },
        { find: "velo-text/adapters/browser", replacement: path.join(src, "adapters/browser/index.ts") },
        { find: "velo-text/editor-web", replacement: path.join(src, "editor-web/index.ts") },
        { find: "velo-text", replacement: path.join(src, "public-api/index.ts") },
      ],
    },
  },
  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
    lineNumbers: true,
  },
});
