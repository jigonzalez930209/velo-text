import type { PortableDocument } from "../../core/model/types.js";
import { renderBlocksToHtml } from "./render.js";

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
  container.innerHTML = renderBlocksToHtml(next);

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
