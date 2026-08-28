import { sniffImage } from "../../assets/sniff/index.js";
import { createImageBlock } from "../../core/model/factories.js";
import type { EditorState } from "../controller/types.js";
import { syncImageResizeOverlay } from "../controller/image-resize.js";
import { commitInsert, locFromHostEl, moveBlockToHost } from "../controller/nesting.js";

const BLOCK_MIME = "application/x-pde-block";

export function attachImageDrop(
  s: EditorState,
  cmds: { insertImage: (assetId: string, w?: number, h?: number) => void },
): { destroy: () => void } {
  let hint: HTMLElement | null = null;
  let msg: HTMLElement | null = null;

  function hideMeta(): void { s.wrapper.querySelector(".pde-img-meta")?.remove(); }
  function clearHost(): void {
    for (const el of s.container.querySelectorAll(".pde-drop-host")) el.classList.remove("pde-drop-host");
  }
  function hostFrom(e: DragEvent): HTMLElement | null {
    return (e.target as HTMLElement)?.closest?.("td, th, .pde-column") as HTMLElement | null;
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
    e.dataTransfer?.setData(BLOCK_MIME, fig.getAttribute("data-node-id") ?? "");
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: DragEvent): void => {
    const types = [...(e.dataTransfer?.types ?? [])];
    const host = hostFrom(e);
    if (types.includes("Files") || types.includes(BLOCK_MIME) || host) e.preventDefault();
    if (types.includes("Files")) showHint(true);
    clearHost();
    host?.classList.add("pde-drop-host");
  };
  const onDragLeave = (): void => { showHint(false); };
  const onDrop = (e: DragEvent): void => {
    e.preventDefault();
    showHint(false);
    const at = hostFrom(e);
    clearHost();
    const blockId = e.dataTransfer?.getData(BLOCK_MIME);
    if (blockId && at && moveBlockToHost(s, blockId, at)) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) void ingest(file, at);
  };

  s.container.addEventListener("dragstart", onDragStart);
  s.container.addEventListener("dragover", onDragOver);
  s.container.addEventListener("dragleave", onDragLeave);
  s.container.addEventListener("drop", onDrop);

  const onDocDown = (e: Event): void => {
    const t = e.target as HTMLElement;
    if (t.closest?.(".pde-img-meta, figure[data-node-type='image']")) return;
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
    const alt = fig.getAttribute("data-alt") ?? "";
    const title = fig.getAttribute("data-title") ?? "";
    box.innerHTML = `<label>Alt<input data-alt value="${esc(alt)}" /></label>
      <label>Caption<input data-cap value="${esc(title)}" /></label>`;
    const apply = (): void => {
      const a = (box.querySelector("[data-alt]") as HTMLInputElement).value;
      const c = (box.querySelector("[data-cap]") as HTMLInputElement).value;
      fig.setAttribute("data-alt", a);
      fig.querySelector("img")?.setAttribute("alt", a);
      if (c) fig.setAttribute("data-title", c); else fig.removeAttribute("data-title");
      s.syncFromDom(false);
    };
    box.querySelectorAll("input").forEach((inp) => inp.addEventListener("change", apply));
    s.wrapper.appendChild(box);
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
      s.container.removeEventListener("dragstart", onDragStart);
      s.container.removeEventListener("dragover", onDragOver);
      s.container.removeEventListener("dragleave", onDragLeave);
      s.container.removeEventListener("drop", onDrop);
    },
  };
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
