import { useEffect, useRef } from "react";
import { mountVanillaEditor } from "portable-doc-editor";

/** Peer: react. Mounts createEditor on a host element; React must not write innerHTML. */
export function PortableEditor({ document, theme, editable, onChange, resolveAssetUrl }) {
  const ref = useRef(null);
  const handle = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    handle.current = mountVanillaEditor(ref.current, { document, theme, editable, onChange, resolveAssetUrl });
    return () => { handle.current?.destroy(); handle.current = null; };
  }, []);
  return <div ref={ref} />;
}
