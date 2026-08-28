import type { bindCommands } from "../controller/commands.js";
import type { EditorState } from "../controller/types.js";
import { attachCommandPalette, type PaletteItem } from "./command-palette.js";
import { attachFindReplace } from "./find-replace.js";
import { attachImageDrop } from "./image-drop.js";
import { attachLinkUi } from "./link-ui.js";
import { collectOutline, focusBlockEl } from "./outline.js";
import { applyPagePreview } from "./page-preview.js";
import { attachSelectionBubble } from "./selection-bubble.js";
import { attachShortcutSheet } from "./shortcuts-sheet.js";
import { attachEquationEditor } from "./equation-editor.js";

export function attachHostUx(
  s: EditorState,
  cmds: ReturnType<typeof bindCommands>,
  history: { undo: () => void; redo: () => void },
) {
  const items = (): PaletteItem[] => [
    { id: "h2", label: "Heading 2", run: () => cmds.setHeading(2) },
    { id: "h1", label: "Heading 1", run: () => cmds.setHeading(1) },
    { id: "h3", label: "Heading 3", run: () => cmds.setHeading(3) },
    { id: "table-3x2", label: "Table 3×2", run: () => cmds.insertTable(2, 3) },
    { id: "var-name", label: "Variable {{name}}", run: () => cmds.insertVariable("name") },
    { id: "eq", label: "Equation", run: () => eq.open() },
    { id: "cols", label: "Columns 50/50", run: () => cmds.insertColumns(2) },
    { id: "quote", label: "Quote", run: () => cmds.toggleQuote() },
    { id: "ul", label: "Bullet list", run: () => cmds.toggleList("unordered") },
    { id: "undo", label: "Undo", run: () => history.undo() },
  ];
  const palette = attachCommandPalette(s, items);
  const find = attachFindReplace(s);
  const keys = attachShortcutSheet(s);
  const eq = attachEquationEditor(s, cmds);
  const bubble = attachSelectionBubble(s, cmds);
  const links = attachLinkUi(s, cmds);
  const drop = attachImageDrop(s, cmds);
  let pageOn = false;
  const prevRender = s.render;
  s.render = () => {
    prevRender();
    if (pageOn) applyPagePreview(s, true);
  };
  return {
    openCommandPalette: palette.open,
    openFind: find.open,
    openShortcuts: keys.open,
    openEquationEditor: eq.open,
    setPagePreview(on: boolean): void {
      pageOn = on;
      applyPagePreview(s, on);
    },
    isPagePreview: () => pageOn,
    getOutline: () => collectOutline(s.getDoc()),
    focusBlock: (id: string) => focusBlockEl(s.container, id),
    destroy() {
      palette.destroy();
      find.destroy();
      keys.destroy();
      bubble.destroy();
      links.destroy();
      drop.destroy();
      eq.destroy();
      applyPagePreview(s, false);
    },
  };
}
