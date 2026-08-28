/**
 * Playground — full-featured demo using the editor controller.
 */
import "../../themes/base.css";
import "../../themes/components.css";
import "./playground.css";
import {
  createDocument,
  createIdGenerator,
  createEditor,
  createTable,
  exportPdf,
  sniffImage,
  getDimensions,
  type PortableDocument,
  type ThemeName,
} from "portable-doc-editor";
import { wireFormatPanel } from "./format-panel.ts";
import { openColumnsMenu, openTableMenu, wireToolbar } from "./toolbar.ts";
import { wirePanels } from "./panels.ts";

const idGen = createIdGenerator("play");
const clock = { nowIso: () => new Date().toISOString() };
let doc = createDocument({ idGenerator: idGen, clock });
doc.metadata.title = "Playground Document";
doc.variableSchema = { name: "string", total: "number" };
for (const [level, text] of [[1, "Welcome"], [2, "Setup"], [2, "Tables"], [3, "Cells"], [2, "Variables"], [1, "Export"]] as const) {
  doc.root.children.push({ type: "heading", id: idGen.next(), level, children: [{ type: "text", id: idGen.next(), text }] });
}
doc.root.children.push(
  { type: "paragraph", id: idGen.next(), children: [
    { type: "text", id: idGen.next(), text: "Type here. Insert variables " },
    { type: "variable", id: idGen.next(), path: "name", source: "{{name}}", valueType: "string" },
    { type: "text", id: idGen.next(), text: " and total " },
    { type: "variable", id: idGen.next(), path: "total", source: "{{total | currency:ARS}}", valueType: "number", format: "currency:ARS" },
    { type: "text", id: idGen.next(), text: ". Use Ctrl+K or / in an empty paragraph." },
  ] },
  createTable(idGen, 2, 2),
);
{
  const tbl = doc.root.children[doc.root.children.length - 1];
  if (tbl && tbl.type === "table") {
    const labels = [["Item", "Qty"], ["Widget", "2"]];
    tbl.rows.forEach((row, ri) => {
      row.header = ri === 0;
      row.cells.forEach((cell, ci) => {
        const p = cell.blocks[0];
        if (p && p.type === "paragraph" && p.children[0] && p.children[0].type === "text") {
          p.children[0].text = labels[ri]?.[ci] ?? "";
        }
      });
    });
  }
}

const editorEl = document.getElementById("editor") as HTMLElement;
const toolbar = document.getElementById("toolbar") as HTMLElement;
const status = document.getElementById("status") as HTMLElement;
const jsonTa = document.getElementById("json") as HTMLTextAreaElement;
const dataTa = document.getElementById("data") as HTMLTextAreaElement;
const varChips = document.getElementById("var-chips") as HTMLElement;
const assetBytes: Record<string, Uint8Array> = {};
const assetUrls: Record<string, string> = {};

async function registerImage(file: File): Promise<{ assetId: string; widthUm?: number; heightUm?: number; error?: string }> {
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

let panels: ReturnType<typeof wirePanels>;
const editor = createEditor(editorEl, {
  document: doc,
  theme: "light-neutral",
  resolveAssetUrl: (id) => assetUrls[id],
  getVariableCatalog: () => ["name", "customer.name", "total", "date"],
  getTemplateData: () => panels?.parseData() ?? {},
  onImageFile: (file) => registerImage(file),
  onChange: (d) => panels?.refresh(d),
});

panels = wirePanels(editor, {
  status, jsonTa, dataTa,
  outline: document.getElementById("outline") as HTMLElement,
  preview: document.getElementById("preview") as HTMLElement,
  unresolved: document.getElementById("unresolved") as HTMLElement,
  saveLabel: document.getElementById("save-label") as HTMLElement,
  revList: document.getElementById("rev-list") as HTMLElement,
  resolveAssetUrl: (id) => assetUrls[id],
  getPdfAssets: () => {
    const live = editor.getDocument();
    const assets: Record<string, { id: string; mediaType: string; data: Uint8Array }> = {};
    for (const [id, bytes] of Object.entries(assetBytes)) {
      const sniff = sniffImage(bytes);
      assets[id] = { id, mediaType: sniff.mediaType ?? live.assets[id]?.mediaType ?? "image/png", data: bytes };
    }
    return assets;
  },
});
try {
  const raw = localStorage.getItem("pde-playground-doc");
  if (raw) editor.setDocument(JSON.parse(raw) as PortableDocument);
} catch { /* ignore */ }

wireToolbar(editor, toolbar, {
  insertVariable: (path) => editor.commands.insertVariable(path),
  insertEquation: (latex) => editor.commands.insertEquation(latex),
  insertImage,
});
wireFormatPanel(editor);

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

async function sha256(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

(document.getElementById("btn-eq") as HTMLButtonElement).onclick = () => editor.openEquationEditor();
(document.getElementById("btn-table") as HTMLButtonElement).onclick = function () { openTableMenu(editor, this); };
(document.getElementById("btn-columns") as HTMLButtonElement).onclick = function () { openColumnsMenu(editor, this); };
(document.getElementById("btn-pagebreak") as HTMLButtonElement).onclick = () => editor.commands.insertBlock("pageBreak");
(document.getElementById("btn-image") as HTMLButtonElement).onclick = () => insertImage();
(document.getElementById("btn-palette") as HTMLButtonElement).onclick = () => editor.openCommandPalette();
(document.getElementById("btn-find") as HTMLButtonElement).onclick = () => editor.openFind(true);
(document.getElementById("btn-keys") as HTMLButtonElement).onclick = () => editor.openShortcuts();
(document.getElementById("btn-page") as HTMLButtonElement).onclick = () => {
  const on = !document.body.classList.contains("pg-page");
  document.body.classList.toggle("pg-page", on);
  editor.setPagePreview(on);
};

(document.getElementById("theme") as HTMLSelectElement).onchange = (e) => {
  const theme = (e.target as HTMLSelectElement).value as ThemeName;
  document.documentElement.setAttribute("data-pde-theme", theme);
  document.body.setAttribute("data-pde-theme", theme);
  editor.setTheme(theme);
};

(document.getElementById("btn-export-pdf") as HTMLButtonElement).onclick = async () => {
  const pdf = await exportPdf({
    document: editor.getDocument(),
    data: panels.parseData(),
    assets: ((): Record<string, { id: string; mediaType: string; data: Uint8Array }> => {
      const live = editor.getDocument();
      const assets: Record<string, { id: string; mediaType: string; data: Uint8Array }> = {};
      for (const [id, bytes] of Object.entries(assetBytes)) {
        const sniff = sniffImage(bytes);
        assets[id] = { id, mediaType: sniff.mediaType ?? live.assets[id]?.mediaType ?? "image/png", data: bytes };
      }
      return assets;
    })(),
    options: { strict: false, missingVariable: "keep" },
  });
  const url = URL.createObjectURL(new Blob([pdf.bytes as unknown as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "playground.pdf";
  a.click();
  URL.revokeObjectURL(url);
  status.textContent = pdf.diagnostics.length
    ? `PDF · ${pdf.byteLength} B · ${pdf.diagnostics.length} notes`
    : `PDF · ${pdf.byteLength} bytes`;
};

panels.refresh(editor.getDocument());
