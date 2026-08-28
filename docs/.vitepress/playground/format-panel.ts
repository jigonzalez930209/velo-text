import type { Editor } from "velo-text";

export function wireFormatPanel(root: HTMLElement, editor: Editor): void {
  const fg = root.querySelector("#fg-color") as HTMLInputElement | null;
  if (fg) fg.oninput = () => editor.commands.setColor(fg.value);
  const bg = root.querySelector("#bg-color") as HTMLInputElement | null;
  if (bg) bg.oninput = () => editor.commands.setHighlight(bg.value);
  const font = root.querySelector("#font-family") as HTMLSelectElement | null;
  if (font) font.onchange = () => editor.commands.setFontFamily(font.value);
  const size = root.querySelector("#font-size") as HTMLSelectElement | null;
  if (size) size.onchange = () => editor.commands.setFontSizePt(Number(size.value));
  root.querySelector("#btn-indent")?.addEventListener("click", () => editor.commands.indent(1));
  root.querySelector("#btn-outdent")?.addEventListener("click", () => editor.commands.indent(-1));
  root.querySelector("#btn-link")?.addEventListener("click", () => {
    const href = window.prompt("Link (https://…)", "https://");
    if (href) editor.commands.insertLink(href);
  });
}
