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
  getIconSvg,
  exportDocument,
  type IconName,
  type PortableDocument,
  type ThemeName,
} from "../../dist/public-api/index.js";
import { createMemorySink } from "../../dist/adapters/browser/index.js";

const idGen = createIdGenerator("play");
const clock = { nowIso: () => new Date().toISOString() };
let doc = createDocument({ idGenerator: idGen, clock });
doc.metadata.title = "Playground Document";
doc.root.children.push(
  { type: "heading", id: idGen.next(), level: 1, children: [{ type: "text", id: idGen.next(), text: "Welcome to the playground" }] },
  { type: "paragraph", id: idGen.next(), children: [
    { type: "text", id: idGen.next(), text: "Type here. Insert variables " },
    { type: "variable", id: idGen.next(), path: "name", source: "{{name}}", valueType: "string" },
    { type: "text", id: idGen.next(), text: ", equations " },
    { type: "equation", id: idGen.next(), latex: "E = mc^2" },
    { type: "text", id: idGen.next(), text: ", tables and images. Hover a block and drag the handle on the left to reorder." },
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

const editor = createEditor(editorEl, {
  document: doc,
  theme: "light-neutral",
  resolveAssetUrl: (id) => assetUrls[id],
  onChange: (d) => {
    jsonTa.value = JSON.stringify(d, null, 2);
    status.textContent = `${d.root.children.length} blocks · rev ${d.revision}`;
  },
});

type ToolbarItem = { icon: IconName; title: string; run: () => void; group: string };

const items: ToolbarItem[] = [
  { icon: "undo2", title: "Undo (Ctrl+Z)", group: "history", run: () => editor.undo() },
  { icon: "redo2", title: "Redo (Ctrl+Y)", group: "history", run: () => editor.redo() },
  { icon: "bold", title: "Bold", group: "marks", run: () => editor.commands.toggleMark("bold") },
  { icon: "italic", title: "Italic", group: "marks", run: () => editor.commands.toggleMark("italic") },
  { icon: "underline", title: "Underline", group: "marks", run: () => editor.commands.toggleMark("underline") },
  { icon: "strikethrough", title: "Strikethrough", group: "marks", run: () => editor.commands.toggleMark("strike") },
  { icon: "code", title: "Code", group: "marks", run: () => editor.commands.toggleMark("code") },
  { icon: "heading1", title: "Title (H1)", group: "blocks", run: () => editor.commands.setHeading(1) },
  { icon: "heading2", title: "Subtitle (H2)", group: "blocks", run: () => editor.commands.setHeading(2) },
  { icon: "heading3", title: "Heading 3", group: "blocks", run: () => editor.commands.setHeading(3) },
  { icon: "quote", title: "Quote", group: "blocks", run: () => editor.commands.toggleQuote() },
  { icon: "listUnordered", title: "Bullet list", group: "blocks", run: () => editor.commands.toggleList("unordered") },
  { icon: "listOrdered", title: "Numbered list", group: "blocks", run: () => editor.commands.toggleList("ordered") },
  { icon: "alignLeft", title: "Align left", group: "align", run: () => editor.commands.setAlign("left") },
  { icon: "alignCenter", title: "Align center", group: "align", run: () => editor.commands.setAlign("center") },
  { icon: "alignRight", title: "Align right", group: "align", run: () => editor.commands.setAlign("right") },
  { icon: "alignJustify", title: "Justify", group: "align", run: () => editor.commands.setAlign("justify") },
  { icon: "variable", title: "Insert {{name}}", group: "insert", run: () => insertVariable("name") },
  { icon: "equation", title: "Insert equation", group: "insert", run: () => insertEquation("\\frac{a}{b}") },
  { icon: "table", title: "Insert 2×2 table", group: "insert", run: () => editor.commands.insertTable(2, 2) },
  { icon: "columns3", title: "Insert 2 columns", group: "insert", run: () => editor.commands.insertColumns(2) },
  { icon: "imagePlus", title: "Insert image", group: "insert", run: () => insertImage() },
  { icon: "eraser", title: "Clear formatting", group: "marks", run: () => editor.commands.clearFormat() },
];

let currentGroup = "";
for (const item of items) {
  if (item.group !== currentGroup) {
    toolbar.appendChild(div("pde-toolbar-group"));
    currentGroup = item.group;
  }
  const btn = document.createElement("button");
  btn.type = "button";
  btn.title = item.title;
  btn.setAttribute("aria-label", item.title);
  btn.innerHTML = getIconSvg(item.icon, { size: 18 });
  btn.addEventListener("mousedown", (e) => e.preventDefault());
  btn.onclick = () => item.run();
  toolbar.lastElementChild?.appendChild(btn);
}
function div(cls: string): HTMLElement {
  const d = document.createElement("div");
  d.className = cls;
  return d;
}

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

function insertVariable(path: string): void {
  editor.commands.insertVariable(path);
}
function insertEquation(latex: string): void {
  editor.commands.insertEquation(latex);
}

(document.getElementById("btn-eq") as HTMLButtonElement).onclick = () => insertEquation("E = mc^2");
(document.getElementById("btn-table") as HTMLButtonElement).onclick = () => editor.commands.insertTable(2, 2);
(document.getElementById("btn-columns") as HTMLButtonElement).onclick = () => editor.commands.insertColumns(2);
(document.getElementById("btn-pagebreak") as HTMLButtonElement).onclick = () => editor.commands.insertBlock("pageBreak");
(document.getElementById("btn-image") as HTMLButtonElement).onclick = () => insertImage();

function insertImage(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/svg+xml";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const assetId = `asset_${Date.now().toString(36)}`;
    const sha256Hex = await sha256(bytes);
    (doc as PortableDocument).assets[assetId] = {
      id: assetId,
      kind: "image",
      mediaType: file.type as never,
      storageKey: `playground/${assetId}`,
      sha256: sha256Hex,
      byteLength: bytes.length,
      alt: file.name,
    };
    assetBytes[assetId] = bytes;
    assetUrls[assetId] = URL.createObjectURL(file);
    const live = editor.getDocument();
    live.assets[assetId] = (doc as PortableDocument).assets[assetId]!;
    editor.commands.insertImage(assetId);
  };
  input.click();
}

async function sha256(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

(document.getElementById("theme") as HTMLSelectElement).onchange = (e) => {
  const theme = (e.target as HTMLSelectElement).value as ThemeName;
  document.documentElement.setAttribute("data-pde-theme", theme);
  document.body.setAttribute("data-pde-theme", theme);
  editor.setTheme(theme);
};

async function doExport(fmt: "pdf" | "odt" | "docx"): Promise<void> {
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(dataTa.value);
  } catch {
    alert("Invalid JSON in Data");
    return;
  }
  const liveDoc = editor.getDocument();
  const { sink, getBytes } = createMemorySink();
  const assets: Record<string, { id: string; mediaType: string; data: Uint8Array }> = {};
  for (const [id, bytes] of Object.entries(assetBytes)) {
    const ref = liveDoc.assets[id];
    const mediaType = ref?.mediaType ?? (bytes[0] === 0xff ? "image/jpeg" : "image/png");
    assets[id] = { id, mediaType, data: bytes };
    if (!liveDoc.assets[id] && ref) liveDoc.assets[id] = ref;
  }
  await exportDocument({ document: liveDoc, data, format: fmt, sink, assets, options: { strict: false } });
  const bytes = getBytes();
  const mime = fmt === "pdf" ? "application/pdf" : fmt === "odt" ? "application/vnd.oasis.opendocument.text" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const blob = new Blob([bytes as unknown as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `playground.${fmt}`;
  a.click();
  URL.revokeObjectURL(url);
  status.textContent = `Exported ${fmt.toUpperCase()} · ${bytes.length} bytes`;
}

(document.getElementById("btn-export-pdf") as HTMLButtonElement).onclick = () => doExport("pdf");
(document.getElementById("btn-export-odt") as HTMLButtonElement).onclick = () => doExport("odt");
(document.getElementById("btn-export-docx") as HTMLButtonElement).onclick = () => doExport("docx");

jsonTa.value = JSON.stringify(editor.getDocument(), null, 2);
status.textContent = `${editor.getDocument().root.children.length} blocks · rev 0`;
