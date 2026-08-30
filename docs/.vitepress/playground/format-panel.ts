import type { Editor } from "velo-text";

/** Side panel controls — color/font/size live in the toolbar type menu (wireToolbar). */
export function wireFormatPanel(root: HTMLElement, editor: Editor): void {
  root.querySelector("#btn-indent")?.addEventListener("click", () => editor.commands.indent(1));
  root.querySelector("#btn-outdent")?.addEventListener("click", () => editor.commands.indent(-1));
  root.querySelector("#btn-link")?.addEventListener("click", () => {
    const href = window.prompt("Link (https://…)", "https://");
    if (href) editor.commands.insertLink(href);
  });
}
