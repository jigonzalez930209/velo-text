/**
 * Fill frontend {{tags}} on the backend and return a PDF.
 * Shared by Express, Vercel, and the Vite dev middleware.
 */
import type { PortableDocument, Clock, IdGenerator } from "../../core/model/types.js";
import { exportPdf, PDF_FILL_OPTIONS } from "../../export/pdf/export-pdf.js";

export interface PdfExportJson {
  document: PortableDocument;
  data?: Record<string, unknown>;
  assets?: Record<string, { id?: string; mediaType: string; data: string | number[] }>;
}

export interface PdfHttpResult {
  status: number;
  headers: Record<string, string>;
  bytes?: Uint8Array;
  error?: string;
}

function asBytes(data: string | number[]): Uint8Array {
  if (Array.isArray(data)) return Uint8Array.from(data);
  const bin = atob(data);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function handlePdfExportJson(
  input: unknown,
  runtime?: { clock?: Clock; idGenerator?: IdGenerator },
): Promise<PdfHttpResult> {
  if (!input || typeof input !== "object") {
    return { status: 400, headers: { "content-type": "application/json" }, error: "JSON body required" };
  }
  const body = input as PdfExportJson;
  if (!body.document || !body.document.root) {
    return { status: 400, headers: { "content-type": "application/json" }, error: "document envelope required" };
  }
  const assets: Record<string, { id: string; mediaType: string; data: Uint8Array }> = {};
  for (const [id, a] of Object.entries(body.assets ?? {})) {
    assets[id] = { id: a.id ?? id, mediaType: a.mediaType, data: asBytes(a.data) };
  }
  try {
    const pdf = await exportPdf({
      document: body.document,
      data: body.data ?? {},
      assets,
      options: PDF_FILL_OPTIONS,
      clock: runtime?.clock,
      idGenerator: runtime?.idGenerator,
    });
    return {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="velo-text.pdf"',
      },
      bytes: pdf.bytes,
    };
  } catch (e) {
    return { status: 422, headers: { "content-type": "application/json" }, error: e instanceof Error ? e.message : "export failed" };
  }
}

type NodeRes = {
  statusCode?: number;
  status?: (n: number) => NodeRes;
  setHeader?: (k: string, v: string) => void;
  json?: (b: unknown) => unknown;
  send?: (b: unknown) => unknown;
  end?: (b?: unknown) => unknown;
};

export async function sendPdfHttpResult(out: PdfHttpResult, res: NodeRes): Promise<void> {
  if (typeof res.status === "function") res.status(out.status);
  else res.statusCode = out.status;
  for (const [k, v] of Object.entries(out.headers)) res.setHeader?.(k, v);
  if (out.error) {
    const payload = { error: out.error };
    if (res.json) { res.json(payload); return; }
    res.end?.(JSON.stringify(payload));
    return;
  }
  const buf = out.bytes ?? new Uint8Array();
  if (res.send) { res.send(Buffer.from(buf)); return; }
  res.end?.(Buffer.from(buf));
}

export async function expressPdfHandler(
  req: { method?: string; body?: unknown },
  res: NodeRes,
): Promise<void> {
  if ((req.method ?? "POST").toUpperCase() !== "POST") {
    await sendPdfHttpResult({ status: 405, headers: { "content-type": "application/json" }, error: "POST only" }, res);
    return;
  }
  await sendPdfHttpResult(await handlePdfExportJson(req.body), res);
}

export async function vercelPdfHandler(
  req: { method?: string; body?: unknown },
  res: NodeRes,
): Promise<void> {
  await expressPdfHandler(req, res);
}

function readStream(req: { on: (ev: string, fn: (c?: Uint8Array | string) => void) => void }): Promise<string> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    req.on("data", (c) => { parts.push(Buffer.from(c ?? "")); });
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", () => reject(new Error("body")));
  });
}

export function vitePdfPlugin(route = "/api/pdf"): { name: string; configureServer: (s: { middlewares: { use: (fn: (...a: unknown[]) => void) => void } }) => void } {
  return {
    name: "velo-text-pdf",
    configureServer(server) {
      server.middlewares.use((...a: unknown[]) => {
        const req = a[0] as { method?: string; url?: string; on: (e: string, f: (c?: Uint8Array | string) => void) => void };
        const res = a[1] as NodeRes;
        const next = a[2] as () => void;
        const path = (req.url ?? "").split("?")[0];
        if (path !== route) { next(); return; }
        const pending = readStream(req);
        void (async () => {
          if ((req.method ?? "").toUpperCase() !== "POST") {
            await sendPdfHttpResult({ status: 405, headers: { "content-type": "application/json" }, error: "POST only" }, res);
            return;
          }
          let json: unknown;
          try { json = JSON.parse(await pending); } catch {
            await sendPdfHttpResult({ status: 400, headers: { "content-type": "application/json" }, error: "invalid json" }, res);
            return;
          }
          await sendPdfHttpResult(await handlePdfExportJson(json), res);
        })();
      });
    },
  };
}
