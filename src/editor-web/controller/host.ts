import { handlePaste } from "../clipboard/index.js";
import { attachInputPipeline } from "../input/index.js";
import type { bindCommands } from "./commands.js";
import type { EditorState } from "./types.js";

export function composingOf(el: HTMLElement): boolean {
  return !!(el as unknown as { _pdeComposing?: boolean })._pdeComposing;
}

export function attachEditing(
  s: EditorState,
  cmds: ReturnType<typeof bindCommands>,
  historyApi: { undo: () => void; redo: () => void },
): () => void {
  const offPipe = attachInputPipeline(s.container, {
    nativeTyping: true,
    isComposing: () => composingOf(s.container),
    onIntent: (intent) => {
      if (intent.type === "toggleMark") cmds.toggleMark(intent.mark);
      else if (intent.type === "undo") historyApi.undo();
      else if (intent.type === "redo") historyApi.redo();
    },
  });

  const onPaste = (e: ClipboardEvent): void => {
    e.preventDefault();
    const html = e.clipboardData?.getData("text/html") || undefined;
    const text = e.clipboardData?.getData("text/plain") || undefined;
    const internal = e.clipboardData?.getData("application/x-pde-fragment") || undefined;
    const result = handlePaste({ html, text, internalFragment: internal });
    const payload = result.sanitizedHtml || result.plainText;
    if (!payload) return;
    try {
      if (result.sanitizedHtml) s.ownerDoc.execCommand("insertHTML", false, result.sanitizedHtml);
      else s.ownerDoc.execCommand("insertText", false, result.plainText);
    } catch {
      const sel = s.selection();
      if (sel && sel.rangeCount) sel.getRangeAt(0).insertNode(s.ownerDoc.createTextNode(result.plainText || payload.replace(/<[^>]+>/g, "")));
    }
    s.lastChangeTime = 0;
    s.syncFromDom(false);
  };
  s.container.addEventListener("paste", onPaste);

  return () => {
    offPipe();
    s.container.removeEventListener("paste", onPaste);
  };
}
