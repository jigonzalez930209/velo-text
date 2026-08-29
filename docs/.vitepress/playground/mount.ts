/**
 * Docs playground — same surface as the former Vite app, scoped to a host root.
 */
import {
  createEditor,
  previewPdf,
  sniffImage,
  getDimensions,
  type PortableDocument,
  type ThemeName,
} from "velo-text";
import { wireFormatPanel } from "./format-panel.ts";
import { openColumnsMenu, openTableMenu, wireToolbar } from "./toolbar.ts";
import { wirePanels } from "./panels.ts";
import { PLAYGROUND_LS, buildSampleDocument } from "./seed.ts";

function q(root: HTMLElement, id: string): HTMLElement {
  const el = root.querySelector(`#${id}`);
  if (!el) throw new Error(`playground missing #${id}`);
  return el as HTMLElement;
}

async function sha256(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function mountPlayground(root: HTMLElement): () => void {
  const sample = buildSampleDocument();
  const doc = sample.doc;
  const assetBytes: Record<string, Uint8Array> = { ...sample.bytes };
  const assetUrls: Record<string, string> = {};
  for (const [id, bytes] of Object.entries(sample.bytes)) {
    assetUrls[id] = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], {
      type: id.includes("svg") ? "image/svg+xml" : "image/png",
    }));
  }
  const el = (id: string) => q(root, id);

  async function registerImage(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniff = sniffImage(bytes);
    const mediaType = (sniff.mediaType ?? file.type ?? "image/png") as never;
    const dim = getDimensions(bytes, sniff.mediaType ?? file.type);
    const assetId = `asset_${Date.now().toString(36)}`;
    const sha256Hex = await sha256(bytes);
    const live = editor.getDocument();
    live.assets[assetId] = {
      id: assetId, kind: "image", mediaType,
      storageKey: `playground/${assetId}`, sha256: sha256Hex, byteLength: bytes.length, alt: file.name,
    };
    assetBytes[assetId] = bytes;
    assetUrls[assetId] = URL.createObjectURL(file);
    let widthUm: number | undefined;
    let heightUm: number | undefined;
    if (dim) {
      const maxW = 150000;
      const scale = Math.min(1, maxW / Math.round((dim.widthPx * 25400) / 96));
      widthUm = Math.max(20000, Math.round((dim.widthPx * 25400) / 96 * scale));
      heightUm = Math.max(12000, Math.round((dim.heightPx * 25400) / 96 * scale));
    }
    return { assetId, widthUm, heightUm };
  }

  function collectPdfAssets() {
    const live = editor.getDocument();
    const assets: Record<string, { id: string; mediaType: string; data: Uint8Array }> = {};
    for (const [id, bytes] of Object.entries(assetBytes)) {
      const sniff = sniffImage(bytes);
      assets[id] = { id, mediaType: sniff.mediaType ?? live.assets[id]?.mediaType ?? "image/png", data: bytes };
    }
    return assets;
  }

  let panels: ReturnType<typeof wirePanels>;
  const editor = createEditor(el("editor"), {
    document: doc,
    theme: "light-neutral",
    resolveAssetUrl: (id) => assetUrls[id],
    getVariableCatalog: () => ["name", "customer.name", "total", "date"],
    getTemplateData: () => panels?.parseData() ?? {},
    onImageFile: (file) => registerImage(file),
    onChange: (d) => panels?.refresh(d),
  });

  panels = wirePanels(root, editor, {
    status: el("status"),
    jsonTa: el("json") as HTMLTextAreaElement,
    dataTa: el("data") as HTMLTextAreaElement,
    outline: el("outline"),
    preview: el("preview"),
    unresolved: el("unresolved"),
    saveLabel: el("save-label"),
    revList: el("rev-list"),
    resolveAssetUrl: (id) => assetUrls[id],
    getPdfAssets: collectPdfAssets,
  });
  try {
    const raw = localStorage.getItem(PLAYGROUND_LS);
    if (raw) editor.setDocument(JSON.parse(raw) as PortableDocument);
  } catch { /* ignore */ }

  el("btn-reset").addEventListener("click", () => {
    try { localStorage.removeItem(PLAYGROUND_LS); } catch { /* ignore */ }
    const next = buildSampleDocument();
    Object.assign(assetBytes, next.bytes);
    for (const [id, bytes] of Object.entries(next.bytes)) {
      if (assetUrls[id]) URL.revokeObjectURL(assetUrls[id]);
      assetUrls[id] = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], {
        type: id.includes("svg") ? "image/svg+xml" : "image/png",
      }));
    }
    editor.setDocument(next.doc);
  });

  function insertImage(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const { assetId, widthUm, heightUm } = await registerImage(file);
      editor.commands.insertImage(assetId, widthUm, heightUm);
    };
    input.click();
  }

  const unwireToolbar = wireToolbar(editor, el("toolbar"), {
    insertVariable: (path) => editor.commands.insertVariable(path),
    insertEquation: (latex) => editor.commands.insertEquation(latex),
    insertImage,
    root,
    onView: () => panels.refresh(editor.getDocument()),
  });
  wireFormatPanel(root, editor);

  const varChips = el("var-chips");
  for (const v of ["name", "customer.name", "total | currency:ARS", "date | date:dd/MM/yyyy"]) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `{{${v}}}`;
    b.onclick = () => {
      const [path, format] = v.split(" | ");
      editor.commands.insertVariable(path!, format);
    };
    varChips.appendChild(b);
  }

  el("btn-eq").addEventListener("click", () => editor.openEquationEditor());
  el("btn-table").addEventListener("click", function () { openTableMenu(editor, this); });
  el("btn-columns").addEventListener("click", function () { openColumnsMenu(editor, this); });
  el("btn-image").addEventListener("click", () => insertImage());

  (el("theme") as HTMLSelectElement).onchange = (e) => {
    const theme = (e.target as HTMLSelectElement).value as ThemeName;
    root.setAttribute("data-pde-theme", theme);
    editor.setTheme(theme);
  };

  el("btn-export-pdf").onclick = async () => {
    const pdf = await previewPdf({
      document: editor.getDocument(),
      data: panels.parseData(),
      assets: collectPdfAssets(),
    });
    const url = URL.createObjectURL(new Blob([pdf.bytes as unknown as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "playground.pdf";
    a.click();
    URL.revokeObjectURL(url);
    el("status").textContent = pdf.diagnostics.length
      ? `PDF · ${pdf.byteLength} B · ${pdf.diagnostics.length} notes`
      : `PDF · ${pdf.byteLength} bytes`;
  };

  panels.refresh(editor.getDocument());
  return () => {
    unwireToolbar();
    editor.destroy();
    for (const u of Object.values(assetUrls)) URL.revokeObjectURL(u);
  };
}
