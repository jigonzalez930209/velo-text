import { mountVanillaEditor } from "velo-text";

/** Svelte action: <div use:portableEditor={opts}></div> */
export function portableEditor(node, opts) {
  let editor = mountVanillaEditor(node, opts);
  return {
    update(next) {
      if (next?.document && next.document !== editor.getDocument()) {
        editor.setDocument(next.document);
      }
      if (next?.theme) editor.setTheme(next.theme);
    },
    destroy() {
      editor.destroy();
    },
  };
}
