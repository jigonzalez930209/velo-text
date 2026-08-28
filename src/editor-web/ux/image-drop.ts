import { sniffImage } from "../../assets/sniff/index.js";
import { createImageBlock } from "../../core/model/factories.js";
import type { EditorState } from "../controller/types.js";
import { hideImageMeta, placeImageMeta, syncImageResizeOverlay } from "../controller/image-resize.js";
import { commitInsert, dropHostFromPoint, locFromHostEl, moveBlockToHost } from "../controller/nesting.js";

const BLOCK_MIME = "application/x-pde-block";

export function attachImageDrop(
  s: EditorState,
  cmds: { insertImage: (assetId: string, w?: number, h?: number) => void },
): { destroy: () => void } {
  let hint: HTMLElement | null = null;
  let msg: HTMLElement | null = null;
  let movingId = "";

  function hideMeta(): void { hideImageMeta(s); }
  function clearHost(): void {
    for (const el of s.container.querySelectorAll(".pde-drop-host")) el.classList.remove("pde-drop-host");
  }
  function hostFrom(e: DragEvent): HTMLElement | null {
    const t = e.target as HTMLElement | null;
    const fromPoint = Number.isFinite(e.clientX) ? dropHostFromPoint(s, e.clientX, e.clientY) : null;
    if (fromPoint) return fromPoint;
    const cell = t?.closest?.("td, th, .pde-column") as HTMLElement | null;
    if (cell && s.container.contains(cell)) return cell;
    const table = t?.closest?.("table") as HTMLElement | null;
    if (table && s.container.contains(table)) return table.querySelector("td, th") as HTMLElement | null;
    const cols = t?.closest?.(".pde-columns") as HTMLElement | null;
    if (cols && s.container.contains(cols)) return cols.querySelector(".pde-column") as HTMLElement | null;
    return null;
  }

  function showHint(on: boolean): void {
    if (!on) { hint?.remove(); hint = null; return; }
    if (hint) return;
    hint = s.ownerDoc.createElement("div");
    hint.className = "pde-drop-hint";
    hint.textContent = "Drop image";
    s.wrapper.appendChild(hint);
  }

  function toast(text: string): void {
    msg?.remove();
    msg = s.ownerDoc.createElement("div");
    msg.className = "pde-drop-msg";
    msg.setAttribute("role", "status");
    msg.textContent = text;
    s.wrapper.appendChild(msg);
    s.ownerDoc.defaultView?.setTimeout(() => { msg?.remove(); msg = null; }, 2400);
  }

  async function ingest(file: File, at: HTMLElement | null): Promise<void> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniff = sniffImage(bytes, file.type);
    if (!sniff.valid) { toast(sniff.reason ?? "Type not allowed"); return; }
    const host = s.opts.onImageFile;
    if (!host) { toast("Host must handle image files"); return; }
    try {
      const res = await host(file);
      if (res.error) { toast(res.error); return; }
      const loc = locFromHostEl(s, at);
      if (loc) commitInsert(s, createImageBlock(s.idGen, res.assetId, { alt: "image", widthUm: res.widthUm, heightUm: res.heightUm }), loc);
      else cmds.insertImage(res.assetId, res.widthUm, res.heightUm);
    } catch {
      toast("Could not add image");
    }
  }

  const onDragStart = (e: DragEvent): void => {
    const fig = (e.target as HTMLElement).closest?.("figure[data-node-type='image']") as HTMLElement | null;
    if (!fig || !s.container.contains(fig)) return;
    movingId = fig.getAttribute("data-node-id") ?? "";
    e.dataTransfer?.setData(BLOCK_MIME, movingId);
    e.dataTransfer?.setData("text/plain", movingId);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setDragImage(fig, 16, 16); } catch { /* jsdom */ }
    }
  };
  const onDragOver = (e: DragEvent): void => {
    const types = [...(e.dataTransfer?.types ?? [])];
    const host = hostFrom(e);
    const moving = Boolean(movingId) || types.includes(BLOCK_MIME) || types.includes("text/plain");
    if (types.includes("Files") || moving || host) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = moving ? "move" : "copy";
    }
    if (types.includes("Files")) showHint(true);
    clearHost();
    host?.classList.add("pde-drop-host");
    host?.closest("table, .pde-columns")?.classList.add("pde-drop-host");
  };
  const onDragLeave = (): void => { showHint(false); };
  const onDragEnd = (): void => { movingId = ""; showHint(false); clearHost(); };
  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    showHint(false);
    const at = hostFrom(e);
    clearHost();
    const blockId = movingId || e.dataTransfer?.getData(BLOCK_MIME) || e.dataTransfer?.getData("text/plain") || "";
    movingId = "";
    if (blockId && at && moveBlockToHost(s, blockId, at)) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) void ingest(file, at);
  };

  for (const el of [s.container, s.wrapper]) {
    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
  }
  s.container.addEventListener("dragend", onDragEnd);

  const onDocDown = (e: Event): void => {
    const n = e.target as Node | null;
    const t = (n && n.nodeType === 1 ? n : n?.parentElement) as HTMLElement | null;
    if (t?.closest?.(".pde-img-meta, .pde-image-resize, figure[data-node-type='image']")) return;
    hideMeta();
  };
  const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") hideMeta(); };
  s.ownerDoc.addEventListener("pointerdown", onDocDown, true);
  s.ownerDoc.addEventListener("keydown", onKey);

  s.addBoth("click", ((e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest?.(".pde-img-meta")) return;
    const fig = t.closest?.("figure[data-node-type='image']") as HTMLElement | null;
    if (!fig || !s.container.contains(fig)) { hideMeta(); return; }
    hideMeta();
    const box = s.ownerDoc.createElement("div");
    box.className = "pde-img-meta";
    box.dataset.imgOwner = fig.getAttribute("data-node-id") ?? "";
    const alt = fig.getAttribute("data-alt") ?? "";
    const title = fig.getAttribute("data-title") ?? "";
    box.innerHTML = `<label>Alt text<input data-alt value="${esc(alt)}" placeholder="Describe the image" /></label>
      <label>Caption<input data-cap value="${esc(title)}" placeholder="Optional" /></label>`;
    const apply = (): void => {
      const a = (box.querySelector("[data-alt]") as HTMLInputElement).value;
      const c = (box.querySelector("[data-cap]") as HTMLInputElement).value;
      fig.setAttribute("data-alt", a);
      fig.querySelector("img")?.setAttribute("alt", a);
      if (c) fig.setAttribute("data-title", c); else fig.removeAttribute("data-title");
      s.syncFromDom(false);
    };
    box.querySelectorAll("input").forEach((inp) => inp.addEventListener("change", apply));
    s.ui.appendChild(box);
    placeImageMeta(s, box, fig);
    syncImageResizeOverlay(s);
  }) as never);

  return {
    destroy() {
      showHint(false);
      msg?.remove();
      hideMeta();
      clearHost();
      s.ownerDoc.removeEventListener("pointerdown", onDocDown, true);
      s.ownerDoc.removeEventListener("keydown", onKey);
      for (const el of [s.container, s.wrapper]) {
        el.removeEventListener("dragstart", onDragStart);
        el.removeEventListener("dragover", onDragOver);
        el.removeEventListener("dragleave", onDragLeave);
        el.removeEventListener("drop", onDrop);
      }
      s.container.removeEventListener("dragend", onDragEnd);
    },
  };
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
