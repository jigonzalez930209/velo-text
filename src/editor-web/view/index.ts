/**
 * Renderer and reconciler — Phase 4.1.1 / 4.1.2
 * Controlled contenteditable host, data-node-id/type, reconciliation by IDs.
 * DOM is a reflection of the AST; AST is the source of truth.
 */
import type { PortableDocument, BlockNode, InlineNode } from "../../core/model/types.js";
import { latexToHtml } from "../../core/equation/index.js";

export interface RenderOptions {
  theme?: string;
  editable?: boolean;
}

export function renderDocumentToHtml(doc: PortableDocument, opts: RenderOptions = {}): string {
  const blocks = doc.root.children.map((b) => renderBlock(b)).join("");
  return `<div class="pde-root" data-pde-theme="${opts.theme ?? "light-neutral"}" contenteditable="${opts.editable ?? true ? "true" : "false"}">${blocks}</div>`;
}

function renderBlock(block: BlockNode): string {
  const id = block.id;
  switch (block.type) {
    case "paragraph":
      return `<p data-node-id="${id}" data-node-type="paragraph">${(block.children ?? []).map(renderInline).join("") || "<br>"}</p>`;
    case "heading":
      return `<h${block.level} data-node-id="${id}" data-node-type="heading">${(block.children ?? []).map(renderInline).join("")}</h${block.level}>`;
    case "quote":
      return `<blockquote data-node-id="${id}" data-node-type="quote">${(block.children ?? []).map(renderInline).join("")}</blockquote>`;
    case "list": {
      const tag = block.kind === "ordered" ? "ol" : "ul";
      const items = block.items
        .map((it) => `<li data-node-id="${it.id}">${it.content.map(renderInline).join("")}${it.nested ? renderBlock(it.nested) : ""}</li>`)
        .join("");
      return `<${tag} data-node-id="${id}" data-node-type="list">${items}</${tag}>`;
    }
    case "table": {
      const colsHtml = block.columns
        .map((c) => `<col style="width:${Math.round((c.widthUm / 25400) * 96)}px" data-col-width-um="${c.widthUm}" />`)
        .join("");
      const rows = block.rows
        .map((row) => {
          const hPx = row.heightUm ? ` style="height:${Math.round((row.heightUm / 25400) * 96)}px" data-height-um="${row.heightUm}"` : "";
          const cells = row.cells
            .map((cell) => {
              const tag = row.header ? "th" : "td";
              return `<${tag} data-node-id="${cell.id}" colspan="${cell.colSpan}" rowspan="${cell.rowSpan}" data-col-index="${cell.colSpan}">${cell.blocks.map(renderBlock).join("")}</${tag}>`;
            })
            .join("");
          return `<tr data-node-id="${row.id}"${hPx}>${cells}</tr>`;
        })
        .join("");
      return `<table data-node-id="${id}" data-node-type="table" style="table-layout:fixed"><colgroup>${colsHtml}</colgroup><tbody>${rows}</tbody></table>`;
    }
    case "image": {
      const wUm = block.widthUm ?? 150000;
      const hUm = block.heightUm ?? 90000;
      const wPx = Math.round((wUm / 25400) * 96);
      const hPx = Math.round((hUm / 25400) * 96);
      return `<figure data-node-id="${id}" data-node-type="image" data-asset-id="${block.assetId}" data-width-um="${wUm}" data-height-um="${hUm}" data-alt="${escapeAttr(block.alt ?? "")}" class="pde-image-block"><img data-asset-id="${block.assetId}" alt="${escapeAttr(block.alt ?? "")}" draggable="false" style="width:${wPx}px;height:${hPx}px" /></figure>`;
    }
    case "page-break":
      return `<div data-node-id="${id}" data-node-type="page-break" class="pde-page-break" data-page-break="true"></div>`;
    case "horizontal-rule":
      return `<hr data-node-id="${id}" data-node-type="horizontal-rule" />`;
    case "equation-block": {
      const latex = escapeAttr((block as unknown as { latex: string }).latex ?? "");
      const inner = latexToHtml((block as unknown as { latex: string }).latex ?? "");
      return `<div data-node-id="${id}" data-node-type="equation-block" contenteditable="false" class="pde-equation pde-equation--block" role="math" aria-label="${latex}" data-latex="${latex}">${inner}</div>`;
    }
    default:
      return `<div data-node-id="${id}">[${(block as { type: string }).type}]</div>`;
  }
}

function renderInline(inline: InlineNode): string {
  switch (inline.type) {
    case "text": {
      let s = escapeHtml(inline.text);
      const m = inline.marks;
      if (!m) return s;
      if (m.bold) s = `<strong>${s}</strong>`;
      if (m.italic) s = `<em>${s}</em>`;
      if (m.underline) s = `<u>${s}</u>`;
      if (m.strike) s = `<s>${s}</s>`;
      if (m.code) s = `<code>${s}</code>`;
      return s;
    }
    case "variable":
      return `<span data-node-id="${inline.id}" data-node-type="variable" contenteditable="false" class="pde-variable" role="button" tabindex="0" data-path="${escapeAttr((inline as unknown as { path: string }).path)}" data-source="${escapeAttr(inline.source)}" aria-label="Variable ${escapeAttr((inline as unknown as { path: string }).path)}">${escapeHtml(inline.source)}</span>`;
    case "link":
      return `<a data-node-id="${inline.id}" href="${escapeAttr(inline.href)}" data-node-type="link">${inline.children.map(renderInline).join("")}</a>`;
    case "inline-image":
      return `<img data-node-id="${inline.id}" data-asset-id="${inline.assetId}" class="pde-inline-image" alt="" />`;
    case "hard-break":
      return `<br data-node-id="${inline.id}" />`;
    case "equation": {
      const latex = (inline as unknown as { latex: string }).latex ?? "";
      const display = (inline as unknown as { display?: boolean }).display;
      const inner = latexToHtml(latex);
      const cls = display ? "pde-equation pde-equation--block" : "pde-equation";
      return `<span data-node-id="${inline.id}" data-node-type="equation" contenteditable="false" class="${cls}" role="math" tabindex="0" aria-label="${escapeAttr(latex)}" data-latex="${escapeAttr(latex)}">${inner}</span>`;
    }
    default:
      return `<span>[${(inline as { type: string }).type}]</span>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

// ── Reconciliation with MutationObserver and IME handling ─────────────────

/**
 * Bidirectional map between nodeId and DOM element for O(1) reconciliation.
 * Used to apply minimal DOM patches by ID and to recover from external mutations.
 */
export function buildNodeMap(root: HTMLElement): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => ((node as HTMLElement).dataset?.nodeId ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  });
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const el = node as HTMLElement;
    const id = el.dataset.nodeId;
    if (id) map.set(id, el);
  }
  return map;
}

/**
 * Apply minimal DOM patch: for MVP we do full re-render but patch via IDs to preserve selection and IME composition.
 * If an IME composition is active, reconciliation is deferred until `compositionend`.
 */
export function reconcileDom(prev: PortableDocument | null, next: PortableDocument, container: HTMLElement): void {
  const isComposing = (container as unknown as { _pdeComposing?: boolean })._pdeComposing;
  if (isComposing) {
    // Defer reconciliation until composition ends
    const handler = () => {
      container.removeEventListener("compositionend", handler);
      (container as unknown as { _pdeComposing?: boolean })._pdeComposing = false;
      reconcileDom(prev, next, container);
    };
    container.addEventListener("compositionend", handler, { once: true });
    return;
  }

  // Preserve current selection (if any) across re-render
  const sel = container.ownerDocument.getSelection();
  const hadFocus = container.contains(sel?.anchorNode as Node);

  // For now, full re-render — future patching can diff by data-node-id
  container.innerHTML = renderDocumentToHtml(next).replace(/^<div[^>]*>/, "").replace(/<\/div>$/, "");

  // Restore selection if we had focus and selection was collapsed at a known nodeId
  if (hadFocus) {
    // Selection restoration is handled by higher-level editor; we just ensure container is focusable
    container.focus();
  }

  // Announce for accessibility
  container.setAttribute("aria-busy", "false");
}

/**
 * Attach MutationObserver to detect unexpected external mutations (extensions, autocorrect, etc.).
 * When a mutation is observed that does not correspond to a pending transaction, schedule a recovery re-render.
 */
export function attachMutationObserver(
  container: HTMLElement,
  getDocument: () => PortableDocument,
  onRecovery: (reason: string) => void,
): MutationObserver {
  let pendingTransaction = false;

  // Expose a way for the editor to mark transactions as pending
  (container as unknown as { _pdeSetPending?: (v: boolean) => void })._pdeSetPending = (v: boolean) => {
    pendingTransaction = v;
  };

  // Track IME composition
  container.addEventListener("compositionstart", () => {
    (container as unknown as { _pdeComposing?: boolean })._pdeComposing = true;
  });
  container.addEventListener("compositionend", () => {
    (container as unknown as { _pdeComposing?: boolean })._pdeComposing = false;
  });

  const observer = new MutationObserver((mutations) => {
    if (pendingTransaction) return;
    // Ignore mutations caused by our own reconciliation (characterData, childList inside pde-root)
    const isExternal = mutations.some((m) => {
      const target = m.target as HTMLElement;
      // If mutation is inside an atomic node (variable, equation) with contenteditable=false, it's unexpected
      const atomic = target.closest?.('[contenteditable="false"]');
      return !!atomic || m.type === "childList";
    });
    if (isExternal) onRecovery(`external mutation: ${mutations[0]?.type}`);
  });
  observer.observe(container, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-node-id", "data-node-type"] });
  return observer;
}

/**
 * Map DOM Selection to logical RangeSelection and back.
 * Handles atomic nodes (variable, equation) by snapping to before/after.
 */
export function domSelectionToLogical(container: HTMLElement): { nodeId: string; offset: number } | null {
  const sel = container.ownerDocument.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0)!;
  const node = range.startContainer as HTMLElement;

  // When selecting an atomic node (span[contenteditable=false]), startContainer is its parent
  // element and startOffset points at the child index — resolve to that child.
  if (node.nodeType === Node.ELEMENT_NODE && range.startOffset < node.childNodes.length) {
    const child = node.childNodes[range.startOffset] as HTMLElement;
    const childHost = child?.closest?.("[data-node-id]") as HTMLElement | null;
    if (childHost && childHost.getAttribute("contenteditable") === "false") {
      return { nodeId: childHost.dataset.nodeId!, offset: 1 };
    }
  }

  const el = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node) as HTMLElement | null;
  const host = el?.closest?.("[data-node-id]") as HTMLElement | null;
  if (!host) return null;
  const nodeId = host.dataset.nodeId!;
  // Offset: for text nodes, use range offset; for atomic nodes, snap to 0 or 1
  const isAtomic = host.getAttribute("contenteditable") === "false";
  const offset = isAtomic ? (range.startOffset > 0 ? 1 : 0) : range.startOffset;
  const affinity = (range as unknown as { affinity?: string }).affinity ?? "forward";
  void affinity;
  return { nodeId, offset };
}

export function logicalToDomSelection(container: HTMLElement, nodeId: string, offset: number): void {
  const el = container.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
  if (!el) return;
  const isAtomic = el.getAttribute("contenteditable") === "false";
  const range = container.ownerDocument.createRange();
  if (isAtomic) {
    // Place caret before or after atomic node
    range.selectNode(el);
    range.collapse(offset === 0);
  } else {
    // Find text node inside
    const textNode = Array.from(el.childNodes).find((n) => n.nodeType === Node.TEXT_NODE) ?? el.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const len = (textNode.textContent ?? "").length;
      range.setStart(textNode, Math.min(offset, len));
      range.collapse(true);
    } else {
      range.selectNodeContents(el);
      range.collapse(offset === 0);
    }
  }
  const sel = container.ownerDocument.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
