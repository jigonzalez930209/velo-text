/**
 * Accessibility — Phase 4 / 7.5
 * Toolbar keyboard navigation, correct ARIA roles, format state announcements,
 * high contrast, visible focus, table/variable trap-free navigation.
 * Manual testing with keyboard and at least two screen readers is required before stable release.
 */

export function ariaLabelForVariable(path: string): string {
  return `Variable ${path}`;
}

export function ensureAltText(alt: string | undefined, decorative: boolean): string | undefined {
  if (decorative) return "";
  if (!alt || !alt.trim()) throw new Error("alt text required for non-decorative image");
  return alt;
}

/**
 * Announce a message to screen readers via aria-live region.
 * Creates a visually hidden live region if not present.
 */
export function announce(container: HTMLElement, message: string, priority: "polite" | "assertive" = "polite"): void {
  let live = container.querySelector(`[data-pde-live="${priority}"]`) as HTMLElement | null;
  if (!live) {
    live = container.ownerDocument.createElement("div");
    live.setAttribute("data-pde-live", priority);
    live.setAttribute("aria-live", priority);
    live.setAttribute("aria-atomic", "true");
    live.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;";
    container.appendChild(live);
  }
  live.textContent = "";
  // Force re-announcement
  setTimeout(() => {
    live!.textContent = message;
  }, 10);
}

/**
 * Make toolbar keyboard navigable — arrow keys, Home/End, Enter/Space to activate.
 * Returns a cleanup function.
 */
export function makeToolbarNavigable(toolbar: HTMLElement): () => void {
  toolbar.setAttribute("role", "toolbar");
  const buttons = () => [...toolbar.querySelectorAll<HTMLElement>('button, [role="button"]')];

  const onKeyDown = (e: KeyboardEvent) => {
    const items = buttons();
    const current = e.target as HTMLElement;
    const idx = items.indexOf(current);
    if (idx === -1) return;
    let nextIdx: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIdx = (idx + 1) % items.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIdx = (idx - 1 + items.length) % items.length;
        break;
      case "Home":
        nextIdx = 0;
        break;
      case "End":
        nextIdx = items.length - 1;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        current.click();
        return;
      default:
        return;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      items[nextIdx]!.focus();
    }
  };

  toolbar.addEventListener("keydown", onKeyDown);
  // Set initial tab indexes
  const init = () => {
    const items = buttons();
    items.forEach((btn, i) => btn.setAttribute("tabindex", i === 0 ? "0" : "-1"));
  };
  init();
  const observer = new MutationObserver(init);
  observer.observe(toolbar, { childList: true, subtree: true });

  return () => {
    toolbar.removeEventListener("keydown", onKeyDown);
    observer.disconnect();
  };
}

/**
 * Ensure focus is not trapped inside atomic nodes (variable, equation) or tables.
 * Variables and equations are contenteditable=false and should be navigated via arrow keys.
 */
export function trapFreeNavigation(container: HTMLElement): void {
  container.addEventListener("keydown", (e) => {
    const sel = container.ownerDocument.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const anchor = sel.anchorNode as HTMLElement | null;
    const atomic = anchor?.closest?.('[data-node-type="variable"], [data-node-type="equation"]') as HTMLElement | null;
    if (!atomic) return;
    // Arrow keys should move past atomic nodes, not into them
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      // Let the editor's selection mapper handle it; prevent default text editing inside atomic
      e.preventDefault();
      const isForward = e.key === "ArrowRight";
      const next = isForward ? atomic.nextSibling : atomic.previousSibling;
      if (next) {
        const range = container.ownerDocument.createRange();
        range.selectNode(next);
        range.collapse(!isForward);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      // Deletion of atomic nodes should be handled as a single operation
      atomic.remove();
      announce(container, `Removed ${atomic.dataset.nodeType}`);
    }
  });
}

/**
 * Check color contrast ratio for accessibility (WCAG AA).
 * Returns ratio and whether it passes for normal text and large text.
 */
export function checkContrast(fg: string, bg: string): { ratio: number; passesAA: boolean; passesAAALarge: boolean } {
  const toRgb = (hex: string): [number, number, number] => {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return [r, g, b];
  };
  const luminance = (rgb: [number, number, number]): number => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  try {
    const l1 = luminance(toRgb(fg));
    const l2 = luminance(toRgb(bg));
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return { ratio, passesAA: ratio >= 4.5, passesAAALarge: ratio >= 3 };
  } catch {
    return { ratio: 0, passesAA: false, passesAAALarge: false };
  }
}

/**
 * Validate that images have required alt text. Used during paste and export.
 */
export function validateImageAlt(alt: string | undefined, decorative: boolean | undefined): { valid: boolean; error?: string } {
  if (decorative) return { valid: true };
  if (!alt || !alt.trim()) return { valid: false, error: "Non-decorative image requires alt text" };
  if (alt.length > 500) return { valid: false, error: "Alt text too long" };
  return { valid: true };
}
