import { useRef, useState } from "react";
import { createDocument, createIdGenerator, exportDocument } from "velo-text";
import { PortableEditor } from "./PortableEditor.jsx";

const MIME = {
  pdf: "application/pdf",
  odt: "application/vnd.oasis.opendocument.text",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function sampleDoc() {
  const g = createIdGenerator("react");
  const doc = createDocument({ idGenerator: g, clock: { nowIso: () => new Date().toISOString() } });
  doc.root.children.push({
    type: "paragraph",
    id: g.next(),
    children: [
      { type: "text", id: g.next(), text: "Hello " },
      { type: "variable", id: g.next(), path: "name", source: "{{name}}", valueType: "string" },
    ],
  });
  return doc;
}

export function App() {
  const editorRef = useRef(null);
  const [status, setStatus] = useState("ready");

  async function doExport(format) {
    const document = editorRef.current?.getDocument();
    if (!document) return;
    const chunks = [];
    await exportDocument({
      document,
      data: { name: "Ada" },
      format,
      sink: { write(c) { chunks.push(c); }, close() {} },
      options: { strict: false },
    });
    const a = window.document.createElement("a");
    a.href = URL.createObjectURL(new Blob(chunks, { type: MIME[format] }));
    a.download = `react.${format}`;
    a.click();
    setStatus(`exported ${format}`);
  }

  return (
    <div data-pde-theme="light-neutral">
      <p>{status}</p>
      <button type="button" onClick={() => editorRef.current?.insertVariable("name")}>Insert variable</button>
      <button type="button" onClick={() => doExport("pdf")}>PDF</button>
      <button type="button" onClick={() => doExport("odt")}>ODT</button>
      <button type="button" onClick={() => doExport("docx")}>DOCX</button>
      <PortableEditor
        ref={editorRef}
        document={sampleDoc()}
        theme="light-neutral"
        onChange={() => setStatus("changed")}
      />
    </div>
  );
}
