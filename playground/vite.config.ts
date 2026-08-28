import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(root, "..", "src");

export default defineConfig({
  server: {
    port: 5173,
    fs: { allow: [path.resolve(root, "..")] },
  },
  resolve: {
    alias: [
      { find: "portable-doc-editor/adapters/browser", replacement: path.join(src, "adapters/browser/index.ts") },
      { find: "portable-doc-editor/editor-web", replacement: path.join(src, "editor-web/index.ts") },
      { find: "portable-doc-editor", replacement: path.join(src, "public-api/index.ts") },
    ],
  },
  build: { outDir: "dist" },
});
