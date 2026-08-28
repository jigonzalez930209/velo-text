import {
  createInMemoryRepository,
  inspectVariables,
  exportPdf,
  type Editor,
  type PortableDocument,
} from "portable-doc-editor";

const LS = "pde-playground-doc";

export function wirePanels(editor: Editor, els: {
  status: HTMLElement;
  jsonTa: HTMLTextAreaElement;
  dataTa: HTMLTextAreaElement;
  outline: HTMLElement;
  preview: HTMLElement;
  unresolved: HTMLElement;
  saveLabel: HTMLElement;
  revList: HTMLElement;
  resolveAssetUrl?: (assetId: string) => string | undefined;
  getPdfAssets?: () => Record<string, { id: string; mediaType: string; data: Uint8Array }>;
}): { refresh: (doc: PortableDocument) => void; parseData: () => Record<string, unknown> } {
  const repo = createInMemoryRepository();
  let expected = 0;
  const tenant = "pg";
  let persistChain = repo.create(editor.getDocument(), tenant).then((r) => { expected = r.currentRevision; }).catch(() => { /* exists */ });

  function parseData(): Record<string, unknown> {
    try { return JSON.parse(els.dataTa.value) as Record<string, unknown>; } catch { return {}; }
  }

  function refreshOutline(): void {
    els.outline.innerHTML = "";
    for (const h of editor.getOutline()) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `${"#".repeat(h.level)} ${h.text}`;
      b.onclick = () => editor.focusBlock(h.id);
      els.outline.appendChild(b);
    }
  }

  let pdfUrl: string | null = null;
  let pdfTimer = 0;

  function refreshPreview(): void {
    const data = parseData();
    const live = editor.getDocument();
    window.clearTimeout(pdfTimer);
    pdfTimer = window.setTimeout(() => {
      void (async () => {
        const pdf = await exportPdf({
          document: live,
          data,
          assets: els.getPdfAssets?.() ?? {},
          options: { strict: false, missingVariable: "keep" },
        });
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        pdfUrl = URL.createObjectURL(new Blob([pdf.bytes as unknown as BlobPart], { type: "application/pdf" }));
        els.preview.innerHTML = "";
        const frame = document.createElement("iframe");
        frame.title = "PDF preview";
        frame.src = pdfUrl;
        els.preview.appendChild(frame);
        const missing = inspectVariables(live).filter((v) => !(v.path.split(".")[0] in data) && data[v.path] === undefined);
        const map = pdf.diagnostics.map((d) => d.message);
        els.unresolved.textContent = map.length
          ? map.join(" · ")
          : (missing.length ? `Unresolved: ${missing.map((v) => v.path).join(", ")}` : "PDF ready");
      })().catch((err) => {
        els.unresolved.textContent = String((err as Error).message ?? err);
      });
    }, 180);
  }

  function persist(doc: PortableDocument): void {
    persistChain = persistChain.then(async () => {
      try { localStorage.setItem(LS, JSON.stringify(doc)); } catch { /* quota */ }
      try {
        const rec = await repo.update(doc.id, tenant, expected, doc);
        expected = rec.currentRevision;
        els.saveLabel.textContent = "Saved";
        const revs = await repo.listRevisions(doc.id, tenant);
        els.revList.innerHTML = "";
        for (const r of revs.slice(-8).reverse()) {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = `rev ${r.currentRevision}`;
          b.onclick = async () => {
            const restored = await repo.restore(doc.id, tenant, r.currentRevision);
            expected = restored.currentRevision;
            editor.setDocument(restored.content);
          };
          els.revList.appendChild(b);
        }
      } catch (err) {
        const code = (err as { code?: string }).code;
        els.saveLabel.textContent = code === "CONFLICT" ? `Conflict (rev ${expected})` : "Offline";
      }
    });
  }

  function refresh(doc: PortableDocument): void {
    els.jsonTa.value = JSON.stringify(doc, null, 2);
    els.status.textContent = `${doc.root.children.length} blocks · rev ${doc.revision}`;
    refreshOutline();
    if (document.body.classList.contains("pg-preview-on") || document.body.classList.contains("pg-split")) refreshPreview();
    persist(doc);
  }

  document.getElementById("view-editor")?.addEventListener("click", () => {
    document.body.classList.remove("pg-preview-on", "pg-split");
  });
  document.getElementById("view-preview")?.addEventListener("click", () => {
    document.body.classList.add("pg-preview-on");
    document.body.classList.remove("pg-split");
    refreshPreview();
  });
  document.getElementById("view-split")?.addEventListener("click", () => {
    document.body.classList.add("pg-split");
    document.body.classList.remove("pg-preview-on");
    refreshPreview();
  });
  els.dataTa.addEventListener("input", () => {
    if (document.body.classList.contains("pg-preview-on") || document.body.classList.contains("pg-split")) refreshPreview();
  });

  return { refresh, parseData };
}
