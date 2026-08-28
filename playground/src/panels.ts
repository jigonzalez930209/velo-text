import {
  createInMemoryRepository,
  inspectVariables,
  renderBlocksToHtml,
  renderTemplate,
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

  function refreshPreview(): void {
    const data = parseData();
    const live = editor.getDocument();
    const rendered = renderTemplate(live, data, { mode: "tolerant", missing: "keep" });
    els.preview.innerHTML = renderBlocksToHtml(rendered.document, els.resolveAssetUrl);
    const missing = inspectVariables(live).filter((v) => !(v.path.split(".")[0] in data) && data[v.path] === undefined);
    els.unresolved.textContent = rendered.diagnostics.length
      ? rendered.diagnostics.map((d) => d.message ?? d.code).join(" · ")
      : (missing.length ? `Unresolved: ${missing.map((v) => v.path).join(", ")}` : "All variables resolved");
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
