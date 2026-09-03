/**
 * Playground toolbar E2E — clicks each wired control and asserts DOM/AST effects.
 */
import { JSDOM } from "jsdom";
import { createDocument, createIdGenerator } from "../../dist/core/model/factories.js";
import { createEditor } from "../../dist/editor-web/controller/index.js";
import { wireToolbar } from "../../dist/editor-web/toolbar/wire-playground.js";

function teardown() {
  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.Node;
  delete globalThis.Selection;
  delete globalThis.Range;
  delete globalThis.MutationObserver;
}

/** jsdom lacks execCommand — shim enough formatting for toolbar wiring tests. */
function installExecCommandShim(dom) {
  const doc = dom.window.document;
  doc.execCommand = (cmd, _ui, value) => {
    const sel = dom.window.getSelection();
    if (!sel?.rangeCount) return false;
    const range = sel.getRangeAt(0).cloneRange();
    const surround = (el) => {
      try {
        range.surroundContents(el);
      } catch {
        const frag = range.extractContents();
        el.appendChild(frag);
        range.insertNode(el);
      }
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    };
    switch (cmd) {
      case "bold": return surround(doc.createElement("b"));
      case "italic": return surround(doc.createElement("i"));
      case "underline": return surround(doc.createElement("u"));
      case "strikeThrough": return surround(doc.createElement("s"));
      case "foreColor": {
        const span = doc.createElement("span");
        span.style.color = String(value);
        return surround(span);
      }
      case "hiliteColor":
      case "backColor": {
        const span = doc.createElement("span");
        span.style.backgroundColor = String(value);
        return surround(span);
      }
      case "formatBlock": {
        const tag = String(value).toLowerCase();
        const node = range.commonAncestorContainer;
        const block = node.nodeType === Node.ELEMENT_NODE
          ? (node.matches("P,H1,H2,H3,H4,H5,H6,BLOCKQUOTE") ? node : node.closest("p, h1, h2, h3, blockquote"))
          : node.parentElement?.closest("p, h1, h2, h3, blockquote");
        if (!block) return false;
        const repl = doc.createElement(tag === "p" ? "p" : tag);
        repl.innerHTML = block.innerHTML;
        for (const a of Array.from(block.attributes)) repl.setAttribute(a.name, a.value);
        block.replaceWith(repl);
        return true;
      }
      case "insertUnorderedList": {
        const node = range.commonAncestorContainer;
        const p = node.nodeType === Node.ELEMENT_NODE && node.tagName === "P"
          ? node
          : node.parentElement?.closest("p");
        if (!p) return false;
        const ul = doc.createElement("ul");
        const li = doc.createElement("li");
        li.innerHTML = p.innerHTML;
        ul.appendChild(li);
        p.replaceWith(ul);
        return true;
      }
      case "insertOrderedList": {
        const node = range.commonAncestorContainer;
        const p = node.nodeType === Node.ELEMENT_NODE && node.tagName === "P"
          ? node
          : node.parentElement?.closest("p");
        if (!p) return false;
        const ol = doc.createElement("ol");
        const li = doc.createElement("li");
        li.innerHTML = p.innerHTML;
        ol.appendChild(li);
        p.replaceWith(ol);
        return true;
      }
      case "removeFormat": {
        const unwrappers = [];
        const walk = (node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const el = node;
          if (/^(B|I|U|S|SPAN)$/i.test(el.tagName)) unwrappers.push(el);
          for (const child of Array.from(el.childNodes)) walk(child);
        };
        walk(range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement ?? range.commonAncestorContainer);
        for (const el of unwrappers) {
          const parent = el.parentNode;
          if (!parent) continue;
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
        return true;
      }
      default:
        return false;
    }
  };
}

function baseDoc() {
  const g = createIdGenerator("tb");
  return createDocument({ idGenerator: g, clock: { nowIso: () => "2026-01-01T00:00:00.000Z" } });
}

function setup(extraBlocks = []) {
  const dom = new JSDOM(
    `<!DOCTYPE html><body><div class="pg-root"><div id="toolbar"></div><div id="editor"></div></div></body>`,
    { pretendToBeVisual: true },
  );
  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Node = dom.window.Node;
  globalThis.Selection = dom.window.Selection;
  globalThis.Range = dom.window.Range;
  globalThis.MutationObserver = dom.window.MutationObserver;
  installExecCommandShim(dom);

  const root = document.querySelector(".pg-root");
  const toolbar = document.getElementById("toolbar");
  const editorEl = document.getElementById("editor");
  const doc = baseDoc();
  doc.root.children.push(
    { type: "paragraph", id: "p1", children: [{ type: "text", id: "t1", text: "hello world" }] },
    ...extraBlocks,
  );
  doc.assets.a1 = {
    id: "a1", kind: "image", mediaType: "image/png", storageKey: "k",
    sha256: "a".repeat(64), byteLength: 10, alt: "x",
  };
  const editor = createEditor(editorEl, { document: doc });
  const unwire = wireToolbar(editor, toolbar, {
    insertVariable: (path) => editor.commands.insertVariable(path),
    insertEquation: (latex) => editor.commands.insertEquation(latex),
    insertImage: () => editor.commands.insertImage("a1", 80000, 50000),
    root,
    onView: () => {},
  });
  return { dom, root, toolbar, editorEl, editor, unwire };
}

function tb(toolbar, label) {
  const btn = toolbar.querySelector(`button[aria-label="${label}"]`);
  assert(btn, `toolbar button "${label}" missing`);
  return btn;
}

function openDrop(toolbar, title) {
  const btn = toolbar.querySelector(`button[title="${title}"]`);
  assert(btn, `dropdown "${title}" missing`);
  if (btn.getAttribute("aria-expanded") !== "true") btn.click();
  assert(btn.getAttribute("aria-expanded") === "true", `menu for "${title}" should open`);
  const menu = Array.from(document.querySelectorAll(".pg-tb-menu")).find((m) => !m.hidden);
  assert(menu, `menu for "${title}" should be visible`);
  return menu;
}

function openTypeMenu(toolbar) {
  openDrop(toolbar, "Type and color");
  return document.querySelector(".pg-tb-menu--type");
}

function dropClick(menu, text) {
  const item = Array.from(menu.querySelectorAll(".pg-tb-item")).find((b) => b.textContent.includes(text));
  assert(item, `dropdown item "${text}" missing`);
  item.click();
}

function focusParagraph(dom, editorEl, blockId = "p1") {
  const p = editorEl.querySelector(`[data-node-id="${blockId}"]`);
  const range = dom.window.document.createRange();
  range.selectNodeContents(p);
  range.collapse(true);
  const sel = dom.window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  editorEl.focus();
  return p;
}

function selectAll(dom, editorEl, blockId = "p1") {
  const p = editorEl.querySelector(`[data-node-id="${blockId}"]`);
  const range = dom.window.document.createRange();
  range.selectNodeContents(p);
  const sel = dom.window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  editorEl.focus();
  return p;
}

function para(editor) {
  return editor.getDocument().root.children.find((b) => b.id === "p1");
}

function textNode(editor) {
  const p = para(editor);
  return p?.children?.find((c) => c.type === "text");
}

test("toolbar: bold, italic, underline", () => {
  const { dom, toolbar, editorEl, editor, unwire } = setup();
  selectAll(dom, editorEl);
  tb(toolbar, "Bold").click();
  tb(toolbar, "Italic").click();
  tb(toolbar, "Underline").click();
  const marks = textNode(editor)?.marks ?? {};
  assert(marks.bold, "bold mark");
  assert(marks.italic, "italic mark");
  assert(marks.underline, "underline mark");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: strikethrough and code from More marks menu", () => {
  const { dom, toolbar, editorEl, editor, unwire } = setup();
  selectAll(dom, editorEl);
  const menu = openDrop(toolbar, "More marks");
  dropClick(menu, "Strikethrough");
  assert(textNode(editor)?.marks?.strike, "strike mark");
  selectAll(dom, editorEl);
  openDrop(toolbar, "More marks");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Code");
  assert(textNode(editor)?.marks?.code, "code mark");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: clear formatting removes marks", () => {
  const { dom, toolbar, editorEl, editor, unwire } = setup();
  selectAll(dom, editorEl);
  tb(toolbar, "Bold").click();
  openDrop(toolbar, "More marks");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Clear formatting");
  const marks = textNode(editor)?.marks ?? {};
  assert(!marks.bold && !marks.strike, "marks cleared");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: headings and quote", () => {
  const { dom, toolbar, editorEl, editor, unwire } = setup();
  focusParagraph(dom, editorEl);
  openDrop(toolbar, "Headings");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Title (H1)");
  let block = editor.getDocument().root.children[0];
  assert(block.type === "heading" && block.level === 1, "H1");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: quote block", () => {
  const { dom, toolbar, editorEl, editor, unwire } = setup();
  focusParagraph(dom, editorEl);
  openDrop(toolbar, "Headings");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Quote");
  const block = editor.getDocument().root.children[0];
  assert(block.type === "quote", "quote block");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: bullet list", () => {
  const { dom, toolbar, editorEl, editor, unwire } = setup();
  focusParagraph(dom, editorEl);
  openDrop(toolbar, "Lists");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Bullet list");
  assert(editor.getDocument().root.children[0].type === "list");
  assert(editor.getDocument().root.children[0].kind === "unordered");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: numbered list", () => {
  const { dom, toolbar, editorEl, editor, unwire } = setup();
  focusParagraph(dom, editorEl);
  openDrop(toolbar, "Lists");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Numbered list");
  assert(editor.getDocument().root.children[0].type === "list");
  assert(editor.getDocument().root.children[0].kind === "ordered");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: alignment buttons", () => {
  const { dom, toolbar, editorEl, editor, unwire } = setup();
  focusParagraph(dom, editorEl);
  tb(toolbar, "Align center").click();
  assert(para(editor)?.align === "center");
  tb(toolbar, "Align right").click();
  assert(para(editor)?.align === "right");
  tb(toolbar, "Justify").click();
  assert(para(editor)?.align === "justify");
  tb(toolbar, "Align left").click();
  assert(!para(editor)?.align || para(editor)?.align === "left");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: insert variable, page break, image", () => {
  const { toolbar, editor, unwire } = setup();
  tb(toolbar, "Insert {{name}}").click();
  assert(JSON.stringify(editor.getDocument()).includes('"path":"name"'));
  tb(toolbar, "Page break").click();
  assert(editor.getDocument().root.children.some((b) => b.type === "page-break"));
  tb(toolbar, "Insert image").click();
  assert(editor.getDocument().root.children.some((b) => b.type === "image"));
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: undo and redo", () => {
  const { dom, toolbar, editorEl, editor, unwire } = setup();
  selectAll(dom, editorEl);
  tb(toolbar, "Bold").click();
  assert(textNode(editor)?.marks?.bold);
  tb(toolbar, "Undo (Ctrl+Z)").click();
  assert(!textNode(editor)?.marks?.bold);
  tb(toolbar, "Redo (Ctrl+Y)").click();
  assert(textNode(editor)?.marks?.bold);
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: font and size selects are not blocked by preventDefault", () => {
  const { dom, toolbar, editorEl, editor, unwire } = setup();
  selectAll(dom, editorEl);
  openTypeMenu(toolbar);
  for (const id of ["font-family", "font-size"]) {
    const sel = document.getElementById(id);
    assert(sel, id);
    const down = new dom.window.MouseEvent("mousedown", { bubbles: true, cancelable: true });
    sel.dispatchEvent(down);
    assert(down.defaultPrevented === false, `${id} must not block native dropdown`);
  }
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: font change with stashed selection (select steals focus)", () => {
  const { dom, toolbar, editorEl, editor, unwire } = setup();
  selectAll(dom, editorEl);
  const stashed = editor.captureTextSelection();
  assert(stashed, "selection captured");
  window.getSelection()?.removeAllRanges();
  openTypeMenu(toolbar);
  const font = document.querySelector("#font-family");
  font.value = "Velo Mono";
  editor.commands.setFontFamily(font.value, stashed);
  assert(textNode(editor)?.marks?.fontFamily === "Velo Mono", "font applied from stash");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: type menu color, highlight, font, size", () => {
  const { dom, toolbar, editorEl, editor, unwire } = setup();
  selectAll(dom, editorEl);
  const menu = openTypeMenu(toolbar);
  assert(menu, "type menu open");
  const fg = menu.querySelector("#fg-color");
  fg.click();
  const red = menu.querySelector('[data-office-hex="#ff0000"]') ?? document.querySelector('[data-office-hex="#ff0000"]');
  red.click();
  assert(textNode(editor)?.marks?.color, "text color applied");
  selectAll(dom, editorEl);
  openTypeMenu(toolbar);
  const bg = document.querySelector("#bg-color");
  bg.click();
  const yellow = document.querySelector('[data-office-hex="#ffff00"]');
  yellow.click();
  assert(textNode(editor)?.marks?.background, "highlight applied");
  selectAll(dom, editorEl);
  openTypeMenu(toolbar);
  const font = document.querySelector("#font-family");
  font.value = "Velo Serif";
  font.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert(textNode(editor)?.marks?.fontFamily === "Velo Serif", "font family applied");
  selectAll(dom, editorEl);
  openTypeMenu(toolbar);
  const size = document.querySelector("#font-size");
  size.value = "18";
  size.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  assert(textNode(editor)?.marks?.fontSizePt === 18, "font size applied");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: insert table via size picker", () => {
  const { toolbar, editor, unwire } = setup();
  tb(toolbar, "Insert table").click();
  const picker = document.querySelector(".pde-size-picker");
  assert(picker, "table picker open");
  const cell = picker.querySelector('[data-c="2"][data-r="2"]');
  cell.click();
  const table = editor.getDocument().root.children.find((b) => b.type === "table");
  assert(table && table.columns.length === 2 && table.rows.length === 2, "2x2 table inserted");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: insert columns via preset", () => {
  const { toolbar, editor, unwire } = setup();
  tb(toolbar, "Insert columns").click();
  const picker = document.querySelector(".pde-mosaic-picker");
  assert(picker, "columns picker open");
  const preset = picker.querySelector(".pde-mosaic-preset");
  preset.click();
  assert(editor.getDocument().root.children.some((b) => b.type === "columns"), "columns block inserted");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: equation button opens editor panel", () => {
  const { toolbar, editor, unwire } = setup();
  tb(toolbar, "Insert equation").click();
  assert(document.querySelector(".pde-eq-editor"), "equation editor opens");
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: view modes and overlays", () => {
  const { toolbar, editor, root, unwire } = setup();
  openDrop(toolbar, "View and tools");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Preview");
  assert(root.classList.contains("pg-preview-on"));
  openDrop(toolbar, "View and tools");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Split");
  assert(root.classList.contains("pg-split"));
  assert(!root.classList.contains("pg-preview-on"));
  openDrop(toolbar, "View and tools");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Editor");
  assert(!root.classList.contains("pg-preview-on") && !root.classList.contains("pg-split"));
  openDrop(toolbar, "View and tools");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Commands");
  assert(document.querySelector(".pde-palette"), "command palette opens");
  openDrop(toolbar, "View and tools");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Find");
  assert(document.querySelector(".pde-find"), "find panel opens");
  openDrop(toolbar, "View and tools");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Shortcuts");
  assert(document.querySelector(".pde-keys"), "shortcuts sheet opens");
  openDrop(toolbar, "View and tools");
  dropClick(document.querySelector(".pg-tb-menu:not([hidden])"), "Page preview");
  assert(root.classList.contains("pg-page"));
  assert(editor.setPagePreview);
  unwire();
  editor.destroy();
  teardown();
});

test("toolbar: every control is wired (smoke inventory)", () => {
  const { toolbar, unwire, editor } = setup();
  const labels = [
    "Undo (Ctrl+Z)", "Redo (Ctrl+Y)", "Bold", "Italic", "Underline",
    "Align left", "Align center", "Align right", "Justify",
    "Insert {{name}}", "Insert equation", "Insert table", "Insert columns",
    "Insert image", "Page break",
  ];
  for (const label of labels) assert(tb(toolbar, label), label);
  for (const title of ["More marks", "Headings", "Lists", "View and tools", "Type and color"]) {
    assert(toolbar.querySelector(`button[title="${title}"]`), title);
  }
  unwire();
  editor.destroy();
  teardown();
});
