import { getIconSvg, openMosaicPicker, openSizePicker, clampTableSize, COLUMN_PRESETS, makeToolbarNavigable, type Editor, type IconName } from "portable-doc-editor";

type ToolbarItem = { icon: IconName; title: string; run: (btn: HTMLElement) => void; group: string };

export function wireToolbar(editor: Editor, toolbar: HTMLElement, helpers: {
  insertVariable: (path: string) => void;
  insertEquation: (latex: string) => void;
  insertImage: () => void;
}): () => void {
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
    { icon: "variable", title: "Insert {{name}}", group: "insert", run: () => helpers.insertVariable("name") },
    { icon: "equation", title: "Insert equation", group: "insert", run: () => editor.openEquationEditor() },
    { icon: "table", title: "Insert table", group: "insert", run: (btn) => openTableMenu(editor, btn) },
    { icon: "columns3", title: "Insert columns", group: "insert", run: (btn) => openColumnsMenu(editor, btn) },
    { icon: "imagePlus", title: "Insert image", group: "insert", run: () => helpers.insertImage() },
    { icon: "eraser", title: "Clear formatting", group: "marks", run: () => editor.commands.clearFormat() },
  ];
  let currentGroup = "";
  for (const item of items) {
    if (item.group !== currentGroup) {
      const d = document.createElement("div");
      d.className = "pde-toolbar-group";
      toolbar.appendChild(d);
      currentGroup = item.group;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = item.title;
    btn.setAttribute("aria-label", item.title);
    btn.innerHTML = getIconSvg(item.icon, { size: 18 });
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.onclick = () => item.run(btn);
    toolbar.lastElementChild?.appendChild(btn);
  }
  return makeToolbarNavigable(toolbar);
}

export function openTableMenu(editor: Editor, anchor: HTMLElement): void {
  openSizePicker(anchor, {
    cols: 4,
    rows: 10,
    label: (c, r) => `Table ${c}×${r}`,
    onPick: (c, r) => editor.commands.insertTable(r, c),
    footer: {
      label: "Choose rows and columns",
      onClick: () => {
        const cols = Number(window.prompt("Columns (1–4)", "2"));
        const rows = Number(window.prompt("Rows (1–10)", "2"));
        if (!Number.isFinite(cols) || !Number.isFinite(rows)) return;
        const size = clampTableSize(cols, rows);
        editor.commands.insertTable(size.rows, size.cols);
      },
    },
  });
}

export function openColumnsMenu(editor: Editor, anchor: HTMLElement): void {
  openMosaicPicker(anchor, {
    presets: COLUMN_PRESETS,
    onPreset: (pcts) => editor.commands.insertColumns(pcts),
    onMosaic: (counts) => editor.commands.insertColumnMosaic(counts),
  });
}
