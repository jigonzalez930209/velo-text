import { umToPx } from "../../export/layout/units.js";
import type { EditorState } from "./types.js";

export function attachImageResize(s: EditorState): { hideImgResize: () => void } {
  let imgResizeEl: HTMLElement | null = null;
  function hideImgResize(): void { imgResizeEl?.remove(); imgResizeEl = null; }

  function positionImgResize(figure: HTMLElement): void {
    if (!imgResizeEl) return;
    const img = figure.querySelector("img") as HTMLElement | null;
    const target = img ?? figure;
    const rect = target.getBoundingClientRect();
    const origin = s.wrapper.getBoundingClientRect();
    imgResizeEl.style.left = `${rect.left - origin.left}px`;
    imgResizeEl.style.top = `${rect.top - origin.top}px`;
    imgResizeEl.style.width = `${rect.width}px`;
    imgResizeEl.style.height = `${rect.height}px`;
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
    const figure = (e.target as HTMLElement).closest?.("figure[data-node-type='image']") as HTMLElement | null;
    if (!figure) { hideImgResize(); return; }
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
        img.style.height = `${Math.round(umToPx(newHUm))}px`;
      }
      figure.setAttribute("data-width-um", String(newWUm));
      figure.setAttribute("data-height-um", String(newHUm));
      positionImgResize(figure);
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
    };
    s.ownerDoc.addEventListener("pointermove", onMove);
    s.ownerDoc.addEventListener("pointerup", onUp);
  }) as never);

  return { hideImgResize };
}
