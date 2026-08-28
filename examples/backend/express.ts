/**
 * Express — POST /api/pdf
 * Body: { document, data, assets? }
 * `document` is editor.getDocument(); `data` fills every {{tag}} from the frontend.
 */
import express from "express";
import { expressPdfHandler } from "velo-text/backend";

const app = express();
app.use(express.json({ limit: "8mb" }));
app.post("/api/pdf", expressPdfHandler);
app.listen(Number(process.env.PORT) || 3000);
