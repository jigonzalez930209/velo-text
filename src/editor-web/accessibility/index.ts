/**
 * Accessibility — Phase 4.2
 * ARIA roles, keyboard-navigable toolbar, live announcements
 */
export function ariaLabelForVariable(path: string): string {
  return `Variable ${path}`;
}

export function ensureAltText(alt: string | undefined, decorative: boolean): string | undefined {
  if (decorative) return "";
  if (!alt) throw new Error("alt text required for non-decorative image");
  return alt;
}
