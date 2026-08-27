import { getIconSvg, type IconName } from "../../assets/icons/index.js";
import { normalizeDocument } from "../../core/normalize/normalize.js";
import type { EditorState, InsertBlockType } from "./types.js";
import { BLOCK_SEL } from "./types.js";
import type { bindCommands } from "./commands.js";

const MENU_ITEMS: Array<{ label: string; icon: IconName; type: InsertBlockType }> = [
  { label: "Paragraph", icon: "alignLeft", type: "paragraph" },
  { label: "Heading 1", icon: "heading1", type: "heading1" },
  { label: "Heading 2", icon: "heading2", type: "heading2" },
  { label: "Heading 3", icon: "heading3", type: "heading3" },
  { label: "Quote", icon: "quote", type: "quote" },
  { label: "Bulleted list", icon: "listUnordered", type: "listUnordered" },
  { label: "Numbered list", icon: "listOrdered", type: "listOrdered" },
  { label: "Table", icon: "table", type: "table" },
  { label: "Columns", icon: "columns3", type: "columns" },
  { label: "Equation", icon: "equation", type: "equationBlock" },
  { label: "Page break", icon: "split", type: "pageBreak" },
  { label: "Horizontal rule", icon: "minus", type: "horizontalRule" },
];

export function attachBlockHandles(s: EditorState, cmds: ReturnType<typeof bindCommands>): { hideHandle: () => void; hideDropLine: () => void } {
  let handleEl: HTMLElement | null = null;
  let menuEl: HTMLElement | null = null;
  let dropLine: HTMLElement | null = null;
  let dragging = false;

  function hideMenu(): void { menuEl?.remove(); menuEl = null; }
  function hideHandle(): void {
    if (dragging) return;
    handleEl?.remove();
    handleEl = null;
    hideMenu();
  }
  function hideDropLine(): void {
    dropLine?.remove();
    dropLine = null;
    for (const el of s.blockElements()) el.classList.remove("pde-drop-above", "pde-drop-below");
  }

  function topLevelBlock(from: HTMLElement | null): HTMLElement | null {
    if (!from || !s.container.contains(from) || from === s.container) return null;
    let cur: HTMLElement = from;
    while (cur.parentElement && cur.parentElement !== s.container) cur = cur.parentElement;
    return cur.parentElement === s.container ? cur : null;
  }

  function positionHandle(blockEl: HTMLElement): void {
    const owner = s.blockIdOf(blockEl);
    if (handleEl && handleEl.dataset.owner === owner) {
      handleEl.style.top = `${blockEl.offsetTop}px`;
      return;
    }
    handleEl?.remove();
    handleEl = s.ownerDoc.createElement("div");
    handleEl.className = "pde-block-handle";
    handleEl.dataset.blockHandle = "";
    handleEl.dataset.owner = owner;
    handleEl.style.top = `${blockEl.offsetTop}px`;
    const grip = s.ownerDoc.createElement("span");
    grip.className = "pde-handle-grip";
    grip.dataset.blockHandleGrip = "";
    grip.innerHTML = getIconSvg("gripVertical", { size: 14 });
    grip.title = "Drag to move block";
    const plus = s.ownerDoc.createElement("span");
    plus.className = "pde-handle-plus";
    plus.dataset.blockHandleMenu = "";
    plus.innerHTML = getIconSvg("plus", { size: 14 });
    plus.title = "Insert block";
    handleEl.append(grip, plus);
    s.ui.append(handleEl);
  }

  const onHoverMove = (e: PointerEvent): void => {
    if (s.destroyed || dragging) return;
    const t = e.target as HTMLElement;
    if (t.closest?.(".pde-block-handle, .pde-block-menu, .pde-table-menu")) return;
    const blockEl = topLevelBlock(t.closest?.(BLOCK_SEL) as HTMLElement | null);
    if (blockEl) positionHandle(blockEl);
  };
  s.wrapper.addEventListener("pointermove", onHoverMove);
  s.cleanup.push(() => s.wrapper.removeEventListener("pointermove", onHoverMove));
  const onMouseOver = (e: MouseEvent): void => onHoverMove(e as unknown as PointerEvent);
  s.container.addEventListener("mouseover", onMouseOver);
  s.cleanup.push(() => s.container.removeEventListener("mouseover", onMouseOver));

  s.addBoth("pointerdown", ((e: PointerEvent) => {
    const grip = (e.target as HTMLElement).closest?.("[data-block-handle-grip]") as HTMLElement | null;
    if (!grip || !handleEl) return;
    const owner = handleEl.dataset.owner;
    e.preventDefault();
    e.stopPropagation();
    const blockEl = s.blockElements().find((b) => s.blockIdOf(b) === owner) ?? null;
    if (!blockEl) return;
    const fromIndex = s.indexOfBlockEl(blockEl);
    let toIndex = fromIndex;
    dragging = true;
    s.wrapper.classList.add("pde-dragging");
    blockEl.classList.add("pde-drag-source");
    dropLine = s.ownerDoc.createElement("div");
    dropLine.className = "pde-drop-line";
    s.ui.append(dropLine);
    const onMove = (ev: PointerEvent): void => {
      const els = s.blockElements();
      let target = fromIndex;
      for (let i = 0; i < els.length; i++) {
        const r = els[i]!.getBoundingClientRect();
        if (ev.clientY > r.top + r.height / 2) target = i;
      }
      toIndex = target;
      for (const el of els) el.classList.remove("pde-drop-above", "pde-drop-below");
      const dest = els[toIndex];
      if (dest && toIndex !== fromIndex) {
        dest.classList.add(toIndex < fromIndex ? "pde-drop-above" : "pde-drop-below");
        dropLine!.style.top = `${toIndex < fromIndex ? dest.offsetTop : dest.offsetTop + dest.offsetHeight}px`;
        dropLine!.style.display = "block";
      } else if (dropLine) dropLine.style.display = "none";
    };
    const onUp = (): void => {
      s.ownerDoc.removeEventListener("pointermove", onMove);
      s.ownerDoc.removeEventListener("pointerup", onUp);
      dragging = false;
      s.wrapper.classList.remove("pde-dragging");
      blockEl.classList.remove("pde-drag-source");
      hideDropLine();
      const doc = s.getDoc();
      if (toIndex !== fromIndex && toIndex >= 0 && toIndex < doc.root.children.length) {
        s.pushSnapshot();
        const [item] = doc.root.children.splice(fromIndex, 1);
        doc.root.children.splice(toIndex, 0, item!);
        s.render();
        s.opts.onChange?.(doc);
      }
    };
    s.ownerDoc.addEventListener("pointermove", onMove);
    s.ownerDoc.addEventListener("pointerup", onUp);
  }) as never);

  s.addBoth("pointerdown", ((e: PointerEvent) => {
    const plus = (e.target as HTMLElement).closest?.("[data-block-handle-menu]") as HTMLElement | null;
    if (!plus || !handleEl) return;
    e.preventDefault();
    e.stopPropagation();
    hideMenu();
    menuEl = s.ownerDoc.createElement("div");
    menuEl.className = "pde-block-menu";
    menuEl.style.top = `${Math.min(handleEl.offsetTop, s.container.clientHeight - 40)}px`;
    menuEl.style.left = "28px";
    for (const item of MENU_ITEMS) {
      const btn = s.ownerDoc.createElement("button");
      btn.type = "button";
      btn.innerHTML = `${getIconSvg(item.icon, { size: 16 })}<span>${item.label}</span>`;
      btn.onclick = () => {
        const blockEl = s.blockElements().find((b) => s.blockIdOf(b) === (handleEl?.dataset.owner ?? ""));
        if (blockEl) cmds.insertBlockAfter(blockEl, item.type);
        hideMenu();
      };
      menuEl.appendChild(btn);
    }
    s.ui.append(menuEl);
  }) as never);

  const onPointerLeave = (e: PointerEvent): void => {
    if (dragging) return;
    const next = e.relatedTarget as Node | null;
    if (next && s.wrapper.contains(next)) return;
    hideHandle();
  };
  s.wrapper.addEventListener("pointerleave", onPointerLeave);
  s.cleanup.push(() => s.wrapper.removeEventListener("pointerleave", onPointerLeave));
  void normalizeDocument;
  return { hideHandle, hideDropLine };
}
