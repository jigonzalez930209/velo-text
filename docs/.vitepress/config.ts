import { defineConfig } from "vitepress";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docsDir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(docsDir, "../..");
const src = path.join(repo, "src");
const base = process.env.DOCS_BASE || "/";

const guideSidebar = [
  {
    text: "Start",
    items: [
      { text: "Introduction", link: "/guide/introduction" },
      { text: "Architecture", link: "/guide/architecture" },
      { text: "Roadmap", link: "/guide/roadmap" },
      { text: "Feature Specifications", link: "/guide/feature-specifications" },
    ],
  },
  {
    text: "Document",
    items: [
      { text: "Data model", link: "/guide/model" },
      { text: "Template engine", link: "/guide/template" },
      { text: "Assets & S3", link: "/guide/assets" },
      { text: "Backend slots (api-report)", link: "/guide/api-report" },
    ],
  },
  {
    text: "Editor",
    items: [
      { text: "Editor", link: "/guide/editor" },
      { text: "Framework adapters", link: "/guide/adapters" },
      { text: "Themes", link: "/guide/themes" },
      { text: "Plugins", link: "/guide/plugins" },
    ],
  },
  {
    text: "Layout & export",
    items: [
      { text: "Layout", link: "/guide/layout" },
      { text: "Export (PDF / ODT / DOCX)", link: "/guide/export" },
    ],
  },
  {
    text: "Host & ship",
    items: [
      { text: "PostgreSQL", link: "/guide/postgres" },
      { text: "Security", link: "/guide/security" },
      { text: "Performance", link: "/guide/performance" },
      { text: "Publish to npm", link: "/guide/publish" },
    ],
  },
  {
    text: "Reference",
    items: [
      { text: "Node × format", link: "/matriz-nodos-formatos" },
      { text: "Threat model", link: "/threat-model" },
      { text: "Perf budgets", link: "/perf-budgets" },
      { text: "Release checklist", link: "/release-checklist" },
    ],
  },
];

const apiSidebar = [
  {
    text: "API",
    items: [
      { text: "Overview", link: "/api/overview" },
      { text: "Public surface", link: "/api/public" },
      { text: "API report", link: "/api-report" },
    ],
  },
  {
    text: "Core",
    items: [
      { text: "Model", link: "/api/core-model" },
      { text: "Schema & canonical", link: "/api/core-schema" },
      { text: "Operations & history", link: "/api/core-operations" },
      { text: "Plugins", link: "/api/plugins" },
    ],
  },
  {
    text: "Product",
    items: [
      { text: "Template", link: "/api/template" },
      { text: "Equation", link: "/api/equation" },
      { text: "Editor web", link: "/api/editor" },
      { text: "Assets", link: "/api/assets" },
      { text: "Export", link: "/api/export" },
      { text: "Layout", link: "/api/layout" },
      { text: "Theme", link: "/api/theme" },
      { text: "Adapters", link: "/api/adapters" },
    ],
  },
];

export default defineConfig({
  title: "velo-text",
  description:
    "Zero-runtime-dependency portable document editor. Canonical JSON AST, typed variables, tables, and deterministic PDF, ODT, and DOCX export.",
  lang: "en-US",
  base,
  head: [
    ["link", { rel: "icon", href: `${base}favicon.svg`.replace("//", "/") }],
    ["meta", { name: "theme-color", content: "#3659e3" }],
  ],
  themeConfig: {
    logo: { src: "/logo.svg", alt: "velo-text" },
    siteTitle: "velo-text",
    nav: [
      { text: "Guide", link: "/guide/introduction" },
      { text: "API", link: "/api/overview" },
      { text: "Playground", link: "/playground/" },
      { text: "Examples", link: "/examples/" },
      { text: "Roadmap", link: "/guide/roadmap" },
      { text: "Changelog", link: "/changelog" },
    ],
    sidebar: {
      "/guide/": guideSidebar,
      "/matriz-nodos-formatos": guideSidebar,
      "/threat-model": guideSidebar,
      "/perf-budgets": guideSidebar,
      "/release-checklist": guideSidebar,
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
            { text: "Backend export", link: "/examples/backend" },
          ],
        },
      ],
      "/api/": apiSidebar,
      "/api-report": apiSidebar,
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
        { find: "velo-text/api-report", replacement: path.join(src, "api-report/index.ts") },
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
