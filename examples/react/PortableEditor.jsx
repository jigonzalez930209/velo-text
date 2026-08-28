import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { mountVanillaEditor } from "velo-text";

/**
 * Peer: react. Mounts createEditor on a host element.
 * Do not write innerHTML / children into the host — the reconciler owns the DOM.
 */
export const PortableEditor = forwardRef(function PortableEditor(
  { document, theme = "light-neutral", editable = true, onChange, resolveAssetUrl, getVariableCatalog, getTemplateData, onImageFile },
  ref,
) {
  const host = useRef(null);
  const handle = useRef(null);

  useEffect(() => {
    if (!host.current) return;
    handle.current = mountVanillaEditor(host.current, {
      document, theme, editable, onChange, resolveAssetUrl, getVariableCatalog, getTemplateData, onImageFile,
    });
    return () => {
      handle.current?.destroy();
      handle.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getDocument: () => handle.current?.getDocument(),
    commands: () => handle.current?.commands,
    insertVariable: (path, format, fallback) => handle.current?.commands.insertVariable(path, format, fallback),
    destroy: () => handle.current?.destroy(),
  }), []);

  return <div ref={host} className="pde-editor" />;
});
