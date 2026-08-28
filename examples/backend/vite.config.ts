import { defineConfig } from "vite";
import { vitePdfPlugin } from "velo-text/backend";

export default defineConfig({
  plugins: [vitePdfPlugin("/api/pdf")],
});
