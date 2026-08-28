import { defineConfig } from "vitepress";

export default defineConfig({
  title: "portable-doc-editor",
  description: "Portable document editor — zero_deps, TypeScript strict, PDF",
  lang: "en-US",
  base: "/",
  head: [
    ["link", { rel: "icon", href: "/favicon.svg" }],
    ["meta", { name: "theme-color", content: "#3659e3" }],
  ],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/introduction" },
      { text: "API", link: "/api/overview" },
      { text: "Playground", link: "/playground/" },
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
    socialLinks: [{ icon: "github", link: "https://github.com/velo-text/portable-doc-editor" }],
    footer: {
      message: "Zero runtime dependencies — TypeScript strict — MIT",
      copyright: "Copyright © 2026 velo-text",
    },
    search: { provider: "local" },
  },
  vite: {
    server: { port: 5174 },
  },
  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
    lineNumbers: true,
  },
});
