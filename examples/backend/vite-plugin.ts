/**
 * Vite — vite.config.ts
 *
 *   import { defineConfig } from "vite";
 *   import { vitePdfPlugin } from "velo-text/backend";
 *   export default defineConfig({ plugins: [vitePdfPlugin("/api/pdf")] });
 *
 * Frontend: POST /api/pdf with JSON { document: editor.getDocument(), data: { name, total } }
 */
export { vitePdfPlugin } from "../../src/adapters/backend/pdf-http.ts";
