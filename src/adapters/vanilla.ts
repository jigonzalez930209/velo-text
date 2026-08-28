import { createEditor, type Editor, type EditorOptions } from "../editor-web/controller/index.js";

export type VanillaEditorOptions = EditorOptions;

/** Official vanilla host: mounts `createEditor` on an element the app owns. */
export function mountVanillaEditor(el: HTMLElement, opts: VanillaEditorOptions): Editor {
  return createEditor(el, opts);
}
