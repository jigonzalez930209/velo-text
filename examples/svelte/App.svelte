<script>
  import { createDocument, createIdGenerator, exportDocument } from "velo-text";
  import { portableEditor } from "./portableEditor.js";

  const MIME = {
    pdf: "application/pdf",
    odt: "application/vnd.oasis.opendocument.text",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  const g = createIdGenerator("svelte");
  let document = createDocument({ idGenerator: g, clock: { nowIso: () => new Date().toISOString() } });
  document.root.children.push({
    type: "paragraph",
    id: g.next(),
    children: [
      { type: "text", id: g.next(), text: "Hello " },
      { type: "variable", id: g.next(), path: "name", source: "{{name}}", valueType: "string" },
    ],
  });
  let host;
  let status = "ready";

  const opts = {
    document,
    theme: "light-neutral",
    onChange: (doc) => { document = doc; status = "changed"; },
  };

  async function doExport(format) {
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
    a.download = `svelte.${format}`;
    a.click();
    status = `exported ${format}`;
  }
</script>

<div data-pde-theme="light-neutral">
  <p>{status}</p>
  <div bind:this={host} class="pde-editor" use:portableEditor={opts}></div>
  <button type="button" on:click={() => doExport("pdf")}>PDF</button>
  <button type="button" on:click={() => doExport("odt")}>ODT</button>
  <button type="button" on:click={() => doExport("docx")}>DOCX</button>
</div>
