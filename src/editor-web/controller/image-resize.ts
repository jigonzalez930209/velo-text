import { umToPx } from "../../export/layout/units.js";
import type { EditorState } from "./types.js";

function placeOverlay(wrapper: HTMLElement, overlay: HTMLElement, figure: HTMLElement): void {
  const img = figure.querySelector("img") as HTMLElement | null;
  const target = img ?? figure;
  const rect = target.getBoundingClientRect();
  const origin = wrapper.getBoundingClientRect();
  overlay.style.left = `${rect.left - origin.left}px`;
  overlay.style.top = `${rect.top - origin.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
}

export function hideImageMeta(s: EditorState): void {
  s.wrapper.querySelector(".pde-img-meta")?.remove();
}

export function placeImageMeta(s: EditorState, box: HTMLElement, figure: HTMLElement): void {
  const img = (figure.querySelector("img") as HTMLElement | null) ?? figure;
  const r = img.getBoundingClientRect();
  const w = s.wrapper.getBoundingClientRect();
  const left = Math.max(8, Math.min(r.left - w.left, Math.max(8, w.width - 248)));
  box.style.left = `${left}px`;
  box.style.top = `${r.bottom - w.top + 6}px`;
}

/** Keep the resize frame and alt/caption box on the bitmap after layout changes. */
export function syncImageResizeOverlay(s: EditorState): void {
  const overlay = s.ui.querySelector(".pde-image-resize") as HTMLElement | null;
  const box = s.wrapper.querySelector(".pde-img-meta") as HTMLElement | null;
  const ownerId = overlay?.dataset.imgOwner ?? box?.dataset.imgOwner;
  const figure = ownerId
    ? s.container.querySelector(`figure[data-node-id="${ownerId}"]`) as HTMLElement | null
    : null;
  if (overlay && figure) placeOverlay(s.wrapper, overlay, figure);
  if (box && figure) placeImageMeta(s, box, figure);
  else if (box && !figure) box.remove();
}

export function attachImageResize(s: EditorState): { hideImgResize: () => void } {
  let imgResizeEl: HTMLElement | null = null;
  function hideImgResize(): void {
    imgResizeEl?.remove();
    imgResizeEl = null;
    hideImageMeta(s);
  }

  const sync = (): void => syncImageResizeOverlay(s);
  const view = s.ownerDoc.defaultView;
  view?.addEventListener("resize", sync);
  s.container.addEventListener("scroll", sync);
  const RO = view?.ResizeObserver;
  const ro = typeof RO === "function" ? new RO(sync) : null;
  ro?.observe(s.wrapper);
  s.cleanup.push(() => {
    view?.removeEventListener("resize", sync);
    s.container.removeEventListener("scroll", sync);
    ro?.disconnect();
  });

  function positionImgResize(figure: HTMLElement): void {
    if (!imgResizeEl) return;
    placeOverlay(s.wrapper, imgResizeEl, figure);
  }

  function findImageBlock(id: string) {
    const walk = (blocks: ReturnType<EditorState["getDoc"]>["root"]["children"]): typeof blocks[number] | undefined => {
      for (const b of blocks) {
        if (b.id === id) return b;
        if (b.type === "table") {
          for (const row of b.rows) for (const cell of row.cells) {
            const f = walk(cell.blocks);
            if (f) return f;
          }
        }
        if (b.type === "columns") {
          for (const col of b.columns) {
            const f = walk(col.blocks);
            if (f) return f;
          }
        }
      }
      return undefined;
    };
    return walk(s.getDoc().root.children);
  }

  s.addBoth("click", ((e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest?.(".pde-img-meta, .pde-image-resize")) return;
    const figure = t.closest?.("figure[data-node-type='image']") as HTMLElement | null;
    if (!figure || !s.container.contains(figure)) { hideImgResize(); return; }
    e.stopPropagation();
    hideImgResize();
    imgResizeEl = s.ownerDoc.createElement("div");
    imgResizeEl.className = "pde-image-resize";
    imgResizeEl.dataset.imgOwner = figure.getAttribute("data-node-id") ?? "";
    positionImgResize(figure);
    for (const pos of ["nw", "se"]) {
      const h = s.ownerDoc.createElement("span");
      h.className = `pde-img-handle ${pos}`;
      h.dataset.imgHandle = pos;
      imgResizeEl.appendChild(h);
    }
    s.ui.append(imgResizeEl);
    view?.requestAnimationFrame(sync);
  }) as never);

  s.addBoth("pointerdown", ((e: PointerEvent) => {
    const h = (e.target as HTMLElement).closest?.("[data-img-handle]") as HTMLElement | null;
    if (!h || !imgResizeEl) return;
    e.preventDefault();
    const ownerId = imgResizeEl.dataset.imgOwner ?? "";
    const figure = (s.container.querySelector(`figure[data-node-id="${ownerId}"]`) as HTMLElement | null)
      ?? (s.container.querySelector("figure[data-node-type='image']") as HTMLElement | null);
    if (!figure) return;
    const id = figure.getAttribute("data-node-id") ?? "";
    const startWUm = Number(figure.getAttribute("data-width-um")) || 150000;
    const startHUm = Number(figure.getAttribute("data-height-um")) || 90000;
    const aspect = startHUm / startWUm;
    const startX = e.clientX;
    s.pushSnapshot();
    const onMove = (ev: PointerEvent): void => {
      const newWUm = Math.max(20000, startWUm + Math.round((ev.clientX - startX) * (25400 / 96)));
      const newHUm = Math.round(newWUm * aspect);
      const img = figure.querySelector("img");
      if (img) {
        img.style.width = `${Math.round(umToPx(newWUm))}px`;
        img.style.height = "auto";
      }
      figure.setAttribute("data-width-um", String(newWUm));
      positionImgResize(figure);
      sync();
    };
    const onUp = (): void => {
      s.ownerDoc.removeEventListener("pointermove", onMove);
      s.ownerDoc.removeEventListener("pointerup", onUp);
      const imgNode = findImageBlock(id);
      if (imgNode && imgNode.type === "image") {
        imgNode.widthUm = Number(figure.getAttribute("data-width-um")) || startWUm;
        imgNode.heightUm = Number(figure.getAttribute("data-height-um")) || startHUm;
        s.opts.onChange?.(s.getDoc());
      }
      sync();
    };
    s.ownerDoc.addEventListener("pointermove", onMove);
    s.ownerDoc.addEventListener("pointerup", onUp);
  }) as never);

  return { hideImgResize };
}
