import { getIconSvg, type IconName } from "../../assets/icons/index.js";
import type { bindCommands } from "../controller/commands.js";
import type { EditorState } from "../controller/types.js";
import { clampToWrapper } from "../controller/table-resize.js";

export function attachSelectionBubble(s: EditorState, cmds: ReturnType<typeof bindCommands>): { destroy: () => void } {
  let bubble: HTMLElement | null = null;

  function hide(): void { bubble?.remove(); bubble = null; }

  function show(): void {
    const sel = s.selection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { hide(); return; }
    const range = sel.getRangeAt(0);
    if (!s.container.contains(range.commonAncestorContainer)) { hide(); return; }
    hide();
    const r = typeof range.getBoundingClientRect === "function"
      ? range.getBoundingClientRect()
      : { left: 8, top: 24, bottom: 24 };
    const w = s.wrapper.getBoundingClientRect();
    bubble = s.ownerDoc.createElement("div");
    bubble.className = "pde-sel-bubble";
    bubble.setAttribute("role", "toolbar");
    bubble.setAttribute("aria-label", "Selection formatting");
    const actions: Array<[IconName, string, () => void]> = [
      ["bold", "Bold", () => cmds.toggleMark("bold")],
      ["italic", "Italic", () => cmds.toggleMark("italic")],
      ["underline", "Underline", () => cmds.toggleMark("underline")],
      ["alignLeft", "Align left", () => cmds.setAlign("left")],
      ["alignCenter", "Align center", () => cmds.setAlign("center")],
      ["alignRight", "Align right", () => cmds.setAlign("right")],
      ["alignJustify", "Justify", () => cmds.setAlign("justify")],
      ["link", "Link", () => {
        const href = s.ownerDoc.defaultView?.prompt?.("Link (https://, mailto:, #)", "https://") ?? "";
        if (href) cmds.insertLink(href);
      }],
      ["eraser", "Clear formatting", () => cmds.clearFormat()],
    ];
    for (const [icon, label, run] of actions) {
      const b = s.ownerDoc.createElement("button");
      b.type = "button";
      b.innerHTML = getIconSvg(icon, { size: 16 });
      b.setAttribute("aria-label", label);
      b.title = label;
      b.onmousedown = (ev) => ev.preventDefault();
      b.onclick = () => { run(); hide(); };
      bubble.appendChild(b);
    }
    bubble.style.left = `${Math.max(8, r.left - w.left)}px`;
    bubble.style.top = `${Math.max(0, r.top - w.top - 40)}px`;
    s.wrapper.appendChild(bubble);
    clampToWrapper(s, bubble);
  }

  const onSel = (): void => {
    if (s.destroyed) return;
    show();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") hide();
  };
  s.ownerDoc.addEventListener("selectionchange", onSel);
  s.container.addEventListener("keyup", onSel);
  s.container.addEventListener("mouseup", onSel);
  s.container.addEventListener("keydown", onKey);

  return {
    destroy() {
      hide();
      s.ownerDoc.removeEventListener("selectionchange", onSel);
      s.container.removeEventListener("keyup", onSel);
      s.container.removeEventListener("mouseup", onSel);
      s.container.removeEventListener("keydown", onKey);
    },
  };
}
