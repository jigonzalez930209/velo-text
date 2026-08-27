/**
 * Playground — demonstrates all editor features, theme switching, variables, tables, images, LaTeX and export.
 * Uses the built `dist/` via workspace link and the plugin system.
 */
import {
  createDocument,
  createIdGenerator,
  createParagraph,
  createText,
  createVariable,
  createTable,
  createEquation,
  createImageBlock,
  exportDocument,
  renderDocumentToHtml,
  getIconSvg,
  registerCommand,
  themes,
} from "../../dist/public-api/index.js";
import { registerPlugin, listPlugins } from "../../dist/core/plugin/index.js";
import { createMemorySink } from "../../dist/adapters/browser/index.js";

const idGen = createIdGenerator("play");
const clock = { nowIso: () => new Date().toISOString() };
let doc = createDocument({ idGenerator: idGen, clock });
doc.metadata.title = "Playground Document";

// Initial content
doc.root.children.push(
  { type: "heading", id: idGen.next(), level: 1, children: [createText(idGen, "Welcome")] },
  {
    type: "paragraph",
    id: idGen.next(),
    children: [
      createText(idGen, "Hello "),
      createVariable(idGen, "name", "{{name}}"),
      createText(idGen, " — try variables, tables, images and "),
      createEquation(idGen, "E = mc^2"),
      createText(idGen, "."),
    ],
  },
);

const editor = document.getElementById("editor") as HTMLElement;
const toolbar = document.getElementById("toolbar") as HTMLElement;
const status = document.getElementById("status") as HTMLElement;
const jsonTa = document.getElementById("json") as HTMLTextAreaElement;
const dataTa = document.getElementById("data") as HTMLTextAreaElement;
const varCatalog = document.getElementById("var-catalog") as HTMLElement;

function render() {
  editor.innerHTML = renderDocumentToHtml(doc).replace(/^<div[^>]*>/, "").replace(/<\/div>$/, "");
  jsonTa.value = JSON.stringify(doc, null, 2);
  status.textContent = `${doc.root.children.length} blocks • rev ${doc.revision}`;
}

// Toolbar with recolorable SVG icons
const commands: Array<{ id: string; label: string; icon: string; action: () => void }> = [
  { id: "bold", label: "Bold", icon: "bold", action: () => document.execCommand("bold") },
  { id: "italic", label: "Italic", icon: "italic", action: () => document.execCommand("italic") },
  { id: "variable", label: "Variable", icon: "variable", action: () => insertVariable("customer.name") },
  { id: "equation", label: "Equation", icon: "equation", action: () => insertEquation("\\frac{a}{b}") },
  { id: "table", label: "Table", icon: "table", action: () => insertTable() },
  { id: "image", label: "Image", icon: "image", action: () => insertImage() },
  { id: "undo", label: "Undo", icon: "undo", action: () => (status.textContent = "Undo (demo)") },
];

function renderToolbar() {
  toolbar.innerHTML = "";
  for (const cmd of commands) {
    const btn = document.createElement("button");
    btn.setAttribute("aria-label", cmd.label);
    btn.title = cmd.label;
    btn.innerHTML = getIconSvg(cmd.icon as never, { size: 16, color: "currentColor", title: cmd.label });
    btn.onclick = cmd.action;
    toolbar.appendChild(btn);
  }
}
renderToolbar();

// Variable catalog
for (const v of ["name", "customer.name", "total | currency:ARS", "date | date:dd/MM/yyyy"]) {
  const b = document.createElement("button");
  b.textContent = `{{${v}}}`;
  b.style.cssText = "padding:4px 6px; border-radius:4px; border:1px solid var(--pde-color-border); background:var(--pde-color-variable-bg); color:var(--pde-color-variable-text); cursor:pointer;";
  b.onclick = () => insertVariable(v.split(" |")[0]!);
  varCatalog.appendChild(b);
}

function insertVariable(path: string) {
  const p = doc.root.children.find((b) => b.type === "paragraph") as ReturnType<typeof createParagraph> | undefined;
  if (!p) return;
  p.children.push(createVariable(idGen, path, `{{${path}}}`));
  doc.revision++;
  render();
}

function insertEquation(latex: string) {
  const p = doc.root.children.find((b) => b.type === "paragraph") as ReturnType<typeof createParagraph> | undefined;
  if (!p) return;
  p.children.push(createEquation(idGen, latex));
  doc.revision++;
  render();
}

function insertTable() {
  doc.root.children.push(createTable(idGen, 2, 2));
  doc.revision++;
  render();
}

function insertImage() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    // For playground, create a fake asset with data URL
    const assetId = `asset_${Date.now()}`;
    const sha256 = "a".repeat(64);
    // @ts-ignore - store in doc.assets for export
    doc.assets[assetId] = { id: assetId, kind: "image", mediaType: file.type as never, storageKey: `playground/${assetId}`, sha256, byteLength: bytes.length, alt: file.name };
    // @ts-ignore - keep bytes for export in memory
    (doc as unknown as { _playgroundAssets?: Record<string, Uint8Array> })._playgroundAssets ??= {};
    (doc as unknown as { _playgroundAssets: Record<string, Uint8Array> })._playgroundAssets[assetId] = bytes;
    doc.root.children.push(createImageBlock(idGen, assetId, { alt: file.name }));
    doc.revision++;
    render();
  };
  input.click();
}

// Theme switcher
(document.getElementById("theme") as HTMLSelectElement).onchange = (e) => {
  const theme = (e.target as HTMLSelectElement).value;
  document.body.setAttribute("data-pde-theme", theme);
  editor.setAttribute("data-pde-theme", theme);
};

// Export helpers
async function doExport(fmt: "pdf" | "odt" | "docx") {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(dataTa.value);
  } catch {
    alert("Invalid JSON in Data");
    return;
  }
  const { sink, getBytes } = createMemorySink();
  const playgroundAssets = (doc as unknown as { _playgroundAssets?: Record<string, Uint8Array> })._playgroundAssets ?? {};
  const assets: Record<string, { id: string; mediaType: string; data: Uint8Array }> = {};
  for (const [id, dataBytes] of Object.entries(playgroundAssets)) {
    const ref = doc.assets[id];
    if (ref) assets[id] = { id, mediaType: ref.mediaType, data: dataBytes as Uint8Array };
  }
  // If no playground assets, use a 1x1 PNG for demo images
  for (const [id, ref] of Object.entries(doc.assets)) {
    if (!assets[id]) assets[id] = { id, mediaType: ref.mediaType, data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) };
  }
  await exportDocument({ document: doc, data, format: fmt, sink, assets, options: { deterministic: false, strict: false } });
  const bytes = getBytes();
  const blob = new Blob([bytes as unknown as BlobPart], { type: fmt === "pdf" ? "application/pdf" : fmt === "odt" ? "application/vnd.oasis.opendocument.text" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `playground.${fmt}`;
  a.click();
  URL.revokeObjectURL(url);
  status.textContent = `Exported ${fmt.toUpperCase()} ${bytes.length} bytes`;
}

document.getElementById("btn-export-pdf")!.onclick = () => doExport("pdf");
document.getElementById("btn-export-odt")!.onclick = () => doExport("odt");
document.getElementById("btn-export-docx")!.onclick = () => doExport("docx");
document.getElementById("btn-insert-var")!.onclick = () => insertVariable("name");
document.getElementById("btn-insert-eq")!.onclick = () => insertEquation("E = mc^2");
document.getElementById("btn-insert-table")!.onclick = () => insertTable();
document.getElementById("btn-insert-image")!.onclick = () => insertImage();

// Plugin sandbox demo
document.getElementById("btn-plugin-eq")!.onclick = () => {
  const latex = (document.getElementById("plugin-latex") as HTMLInputElement).value || "\\sqrt{x}";
  // Example external plugin: register a formatter and insert via command
  try {
    registerPlugin({
      type: "demo-plugin",
      version: 1,
      schema: { type: "object" } as never,
      createNode: () => createEquation(idGen, latex),
      renderWeb: (node: unknown) => `<span>${(node as { latex: string }).latex}</span>`,
    });
    insertEquation(latex);
    status.textContent = `Plugin demo-plugin used — plugins: ${listPlugins().join(", ")}`;
  } catch (e) {
    status.textContent = `Plugin error: ${(e as Error).message}`;
  }
};

// Initial render + simple plugin registration
registerCommand({ id: "demo.hello", label: "Hello", icon: "more", canExecute: () => true, execute: () => alert("Hello from plugin!") });
render();
status.textContent = `Ready — ${Object.keys(themes).length} themes, plugins: ${listPlugins().length}`;
