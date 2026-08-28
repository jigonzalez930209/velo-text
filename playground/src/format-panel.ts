import type { Editor } from "portable-doc-editor";

export function wireFormatPanel(editor: Editor): void {
  const fg = document.getElementById("fg-color") as HTMLInputElement | null;
  if (fg) fg.oninput = () => editor.commands.setColor(fg.value);
  const bg = document.getElementById("bg-color") as HTMLInputElement | null;
  if (bg) bg.oninput = () => editor.commands.setHighlight(bg.value);
  const font = document.getElementById("font-family") as HTMLSelectElement | null;
  if (font) font.onchange = () => editor.commands.setFontFamily(font.value);
  const size = document.getElementById("font-size") as HTMLSelectElement | null;
  if (size) size.onchange = () => editor.commands.setFontSizePt(Number(size.value));
  document.getElementById("btn-indent")?.addEventListener("click", () => editor.commands.indent(1));
  document.getElementById("btn-outdent")?.addEventListener("click", () => editor.commands.indent(-1));
  document.getElementById("btn-link")?.addEventListener("click", () => {
    const href = window.prompt("Link (https://…)", "https://");
    if (href) editor.commands.insertLink(href);
  });
}
