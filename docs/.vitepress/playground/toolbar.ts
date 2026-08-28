import { getIconSvg, openMosaicPicker, openSizePicker, clampTableSize, COLUMN_PRESETS, makeToolbarNavigable, placeOverlay, type Editor, type IconName } from "velo-text";

type DropItem = { label: string; icon?: IconName; run: () => void; keepOpen?: boolean };

function itemHtml(it: DropItem): string {
  const ic = it.icon ? getIconSvg(it.icon, { size: 16 }) : "";
  return `${ic}<span>${it.label}</span>`;
}

export function wireToolbar(editor: Editor, toolbar: HTMLElement, helpers: {
  insertVariable: (path: string) => void;
  insertEquation: (latex: string) => void;
  insertImage: () => void;
  root: HTMLElement;
  onView?: () => void;
}): () => void {
  const group = (): HTMLElement => {
    const d = document.createElement("div");
    d.className = "pde-toolbar-group";
    toolbar.appendChild(d);
    return d;
  };
  const addBtn = (g: HTMLElement, icon: IconName, title: string, run: (btn: HTMLButtonElement) => void): HTMLButtonElement => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.innerHTML = getIconSvg(icon, { size: 18 });
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.onclick = () => run(btn);
    g.appendChild(btn);
    return btn;
  };
  const drops: Array<{ btn: HTMLButtonElement; menu: HTMLElement }> = [];
  const addDrop = (g: HTMLElement, icon: IconName, title: string, items: DropItem[], persist = false): HTMLElement => {
    const wrap = document.createElement("div");
    wrap.className = "pg-tb-dropwrap";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pg-tb-drop";
    btn.title = title;
    btn.setAttribute("aria-haspopup", "true");
    btn.innerHTML = `${getIconSvg(icon, { size: 18 })}${getIconSvg("chevronDown", { size: 12 })}`;
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    const menu = document.createElement("div");
    menu.className = "pg-tb-menu";
    menu.hidden = true;
    for (const it of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pg-tb-item";
      b.innerHTML = itemHtml(it);
      b.onclick = () => {
        it.run();
        if (!persist && !it.keepOpen) {
          menu.hidden = true;
          btn.setAttribute("aria-expanded", "false");
        }
      };
      menu.appendChild(b);
    }
    btn.onclick = () => {
      const open = menu.hidden;
      drops.forEach((d) => {
        d.menu.hidden = true;
        d.btn.setAttribute("aria-expanded", "false");
      });
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (!menu.hidden) placeOverlay(btn, menu);
    };
    wrap.append(btn);
    g.appendChild(wrap);
    helpers.root.appendChild(menu);
    drops.push({ btn, menu });
    return menu;
  };

  const hist = group();
  addBtn(hist, "undo2", "Undo (Ctrl+Z)", () => editor.undo());
  addBtn(hist, "redo2", "Redo (Ctrl+Y)", () => editor.redo());

  const marks = group();
  addBtn(marks, "bold", "Bold", () => editor.commands.toggleMark("bold"));
  addBtn(marks, "italic", "Italic", () => editor.commands.toggleMark("italic"));
  addBtn(marks, "underline", "Underline", () => editor.commands.toggleMark("underline"));
  addDrop(marks, "moreHorizontal", "More marks", [
    { label: "Strikethrough", icon: "strikethrough", run: () => editor.commands.toggleMark("strike") },
    { label: "Code", icon: "code", run: () => editor.commands.toggleMark("code") },
    { label: "Clear formatting", icon: "eraser", run: () => editor.commands.clearFormat() },
  ]);

  const blocks = group();
  addDrop(blocks, "heading1", "Headings", [
    { label: "Title (H1)", icon: "heading1", run: () => editor.commands.setHeading(1) },
    { label: "Subtitle (H2)", icon: "heading2", run: () => editor.commands.setHeading(2) },
    { label: "Heading 3", icon: "heading3", run: () => editor.commands.setHeading(3) },
    { label: "Quote", icon: "quote", run: () => editor.commands.toggleQuote() },
  ]);
  addDrop(blocks, "listUnordered", "Lists", [
    { label: "Bullet list", icon: "listUnordered", run: () => editor.commands.toggleList("unordered") },
    { label: "Numbered list", icon: "listOrdered", run: () => editor.commands.toggleList("ordered") },
  ]);

  const align = group();
  addBtn(align, "alignLeft", "Align left", () => editor.commands.setAlign("left"));
  addBtn(align, "alignCenter", "Align center", () => editor.commands.setAlign("center"));
  addBtn(align, "alignRight", "Align right", () => editor.commands.setAlign("right"));
  addBtn(align, "alignJustify", "Justify", () => editor.commands.setAlign("justify"));

  const insert = group();
  addBtn(insert, "variable", "Insert {{name}}", () => helpers.insertVariable("name"));
  addBtn(insert, "equation", "Insert equation", () => editor.openEquationEditor());
  addBtn(insert, "table", "Insert table", (btn) => openTableMenu(editor, btn));
  addBtn(insert, "columns3", "Insert columns", (btn) => openColumnsMenu(editor, btn));
  addBtn(insert, "imagePlus", "Insert image", () => helpers.insertImage());
  addBtn(insert, "split", "Page break", () => editor.commands.insertBlock("pageBreak"));

  const view = group();
  const root = helpers.root;
  addDrop(view, "panelLeft", "View and tools", [
    { label: "Editor", icon: "fileText", run: () => { root.classList.remove("pg-preview-on", "pg-split"); helpers.onView?.(); } },
    { label: "Preview", icon: "image", run: () => { root.classList.add("pg-preview-on"); root.classList.remove("pg-split"); helpers.onView?.(); } },
    { label: "Split", icon: "split", run: () => { root.classList.add("pg-split"); root.classList.remove("pg-preview-on"); helpers.onView?.(); } },
    { label: "Commands", icon: "palette", run: () => editor.openCommandPalette() },
    { label: "Find", icon: "plus", run: () => editor.openFind(true) },
    { label: "Shortcuts", icon: "sliders", run: () => editor.openShortcuts() },
    { label: "Page preview", icon: "fileText", run: () => {
      const next = !root.classList.contains("pg-page");
      root.classList.toggle("pg-page", next);
      editor.setPagePreview(next);
    } },
  ]);

  const typeG = group();
  const typeMenu = addDrop(typeG, "color", "Type and color", [], true);
  typeMenu.classList.add("pg-tb-menu--type");
  const colorRow = (icon: IconName, title: string, id: string, value: string, on: (v: string) => void): void => {
    const row = document.createElement("label");
    row.className = "pg-tb-row";
    row.title = title;
    const inp = document.createElement("input");
    inp.type = "color";
    inp.id = id;
    inp.value = value;
    inp.oninput = () => on(inp.value);
    row.innerHTML = `${getIconSvg(icon, { size: 16 })}<span>${title}</span>`;
    row.appendChild(inp);
    typeMenu.appendChild(row);
  };
  colorRow("color", "Text color", "fg-color", "#17191c", (v) => editor.commands.setColor(v));
  colorRow("background", "Highlight", "bg-color", "#fff59d", (v) => editor.commands.setHighlight(v));
  const fontRow = document.createElement("label");
  fontRow.className = "pg-tb-row";
  fontRow.innerHTML = `${getIconSvg("fileText", { size: 16 })}<span>Font</span>`;
  const font = document.createElement("select");
  font.id = "font-family";
  font.innerHTML = `<option value="sans-serif">Sans</option><option value="serif">Serif</option><option value="monospace">Mono</option>`;
  font.onchange = () => editor.commands.setFontFamily(font.value);
  fontRow.appendChild(font);
  typeMenu.appendChild(fontRow);
  const sizeRow = document.createElement("label");
  sizeRow.className = "pg-tb-row";
  sizeRow.innerHTML = `${getIconSvg("sliders", { size: 16 })}<span>Size</span>`;
  const size = document.createElement("select");
  size.id = "font-size";
  size.innerHTML = `<option value="11">11</option><option value="12" selected>12</option><option value="14">14</option><option value="18">18</option>`;
  size.onchange = () => editor.commands.setFontSizePt(Number(size.value));
  sizeRow.appendChild(size);
  typeMenu.appendChild(sizeRow);

  const navOff = makeToolbarNavigable(toolbar);
  const onDocDown = (ev: Event): void => {
    const t = ev.target as Node | null;
    if (!t) return;
    if (drops.some((d) => d.menu.contains(t) || d.btn.contains(t))) return;
    for (const d of drops) {
      d.menu.hidden = true;
      d.btn.setAttribute("aria-expanded", "false");
    }
  };
  const onResize = (): void => {
    for (const d of drops) if (!d.menu.hidden) placeOverlay(d.btn, d.menu);
  };
  toolbar.ownerDocument.addEventListener("mousedown", onDocDown, true);
  toolbar.ownerDocument.defaultView?.addEventListener("resize", onResize);
  return () => {
    navOff();
    toolbar.ownerDocument.removeEventListener("mousedown", onDocDown, true);
    toolbar.ownerDocument.defaultView?.removeEventListener("resize", onResize);
    for (const d of drops) d.menu.remove();
  };
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
