import { mountVanillaEditor } from "portable-doc-editor";

/** Svelte action: <div use:portableEditor={opts}></div> */
export function portableEditor(node, opts) {
  const editor = mountVanillaEditor(node, opts);
  return {
    destroy() { editor.destroy(); },
  };
}
