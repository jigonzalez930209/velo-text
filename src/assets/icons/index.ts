/**
 * Toolbar and UI icons — Phase 4 / 11
 * All SVGs are included inline with no external dependencies.
 * Colors are controlled via `currentColor` and CSS variables, allowing runtime theming.
 *
 * Design principles:
 * - Each icon is a 16x16 or 20x20 viewBox SVG with stroke="currentColor" / fill="currentColor" where appropriate.
 * - No hardcoded hex colors inside the SVG path except `none`; color comes from CSS `color` or `--pde-icon-color`.
 * - Size and color can be overridden via options or CSS.
 * - Icons are tree-shakable named exports; a registry map is also provided for dynamic lookup.
 */

export type IconName =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "code"
  | "heading1"
  | "heading2"
  | "heading3"
  | "quote"
  | "ul"
  | "ol"
  | "link"
  | "image"
  | "table"
  | "variable"
  | "equation"
  | "pageBreak"
  | "horizontalRule"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "alignJustify"
  | "undo"
  | "redo"
  | "clearFormat"
  | "color"
  | "background"
  | "more";

export interface IconOptions {
  /** Size in pixels (width and height). Default 16. */
  size?: number;
  /** CSS color value or variable. Default "currentColor" (inherits from parent). */
  color?: string;
  /** Additional CSS class. */
  className?: string;
  /** Accessible title. */
  title?: string;
  /** Stroke width override. Default 1.5. */
  strokeWidth?: number;
}

/**
 * Raw SVG paths using currentColor. Each entry is the inner <path> content, not the full <svg> wrapper.
 * Keeping them as template strings allows color/size injection at render time without parsing.
 */
const ICON_PATHS: Record<IconName, string> = {
  // Text marks
  bold: '<path d="M7 4h3.5a2.5 2.5 0 010 5H7V4zm0 5h4a2.75 2.75 0 010 5.5H7V9z" />',
  italic: '<path d="M10.5 4L7.5 13H8.5L11.5 4H10.5z" />',
  underline: '<path d="M5 13.5V12h8v1.5H5zM7 4v4a2 2 0 004 0V4h1.2v4a3.2 3.2 0 01-6.4 0V4H7z" />',
  strike: '<path d="M4 8.5h12v1H4zM7 4.5V7h1.2V4.5a1.8 1.8 0 113.6 0V7H13V4.5a3 3 0 00-6 0zM7 9v2.5a1.8 1.8 0 003.6 0V9h1.2v2.5a3 3 0 01-6 0V9H7z" />',
  code: '<path d="M6 5L2.5 8 6 11l-.7.7L1.5 8l3.8-3.8L6 5zm6 0l.7-.7L16.5 8l-3.8 3.8L12 11l3.5-3L12 5zM9.5 3.5l-1 9 1.1.2 1-9-1.1-.2z" />',
  // Headings
  heading1: '<path d="M3 4h1.5v5H7.5V4H9v9.5H7.5V10.5H4.5v3H3V4zM10.5 7h1.2l2.2 6.5h-1.4l-.5-1.6h-2.2l-.5 1.6H8L10.5 7zM11.1 10.2l-.7-2.1-.7 2.1h1.4z" />',
  heading2: '<path d="M3 4h6v1.2H4.5v2.5H8V9H4.5v2.3H9v1.2H3V4zm7.5 0h4.5v1.2h-3v2h2.5v1.2H12v1.9h3v1.2h-4.5V4z" />',
  heading3: '<path d="M3 4h1.4l1.7 3.2L7.8 4H9.2l-2.4 4.3 2.5 5.2H7.8l-1.7-3.6-1.7 3.6H3l2.5-5.2L3 4z" />',
  // Blocks
  quote: '<path d="M3 5h3.2l.8 2.5H5c0 1.2.4 2 1.3 2.4v1.1a3.2 3.2 0 01-2.1-.9 3.5 3.5 0 01-1.2-2.7V5zm6 0h3.2l.8 2.5H11c0 1.2.4 2 1.3 2.4v1.1a3.2 3.2 0 01-2.1-.9 3.5 3.5 0 01-1.2-2.7V5z" />',
  ul: '<path d="M3 5.5h1.5v1H3zM3 8h1.5v1H3zM3 10.5h1.5v1H3zM6.5 5.5H15v1H6.5zM6.5 8H15v1H6.5zM6.5 10.5H15v1H6.5z" />',
  ol: '<path d="M3 5.2V4h1.6v.4H4v.8h.6V5.6H3v.8h1.6v.4H3zM3 8.3V7h1.6v.4H4v.4h1v.4H4v.5h.6V9H3v-.7zM3 11.4V10H4.6v1.4H3zm.5-.9h.6v.5H3.5zM6.5 5.5H15v1H6.5zM6.5 8H15v1H6.5zM6.5 10.5H15v1H6.5z" />',
  link: '<path d="M6.5 9.5l1.2-1.2 2 2 1.2-1.2-2-2 1.5-1.5 2 2a2.5 2.5 0 01-3.5 3.5l-2-2zM9.5 6.5l-2 2-1.2-1.2 2-2A2.5 2.5 0 0111.8 9l-2 2-1.2-1.2 2-2z" />',
  image: '<path d="M3 4.5h12v9H3zM3.8 12.2l2.8-3.6 1.9 2.2 1.4-1.6 2.3 3H3.8zM6.2 7.5a1.2 1.2 0 110-2.4 1.2 1.2 0 010 2.4z" />',
  table: '<path d="M3 4.5h12v9H3zM3 7.5h12M3 10.5h12M7.5 4.5v9M11 4.5v9" />',
  variable: '<path d="M3 5h3.5l1 2 1-2H12v1.2H9.8l-1.6 3.1 1.6 3.1H12v1.1H8.2l-1-1.9-1 1.9H3v-1.1h2.2l1.6-3.1L5.2 6.2H3V5z" />',
  equation: '<path d="M3 8.5h1.2l.8-2 1.5 4 1.5-4 .8 2H10V7.5H9.2l-.5-1.4-1.2 3.2-1.2-3.2L5.8 7.5H5V8.5h1zM11 4.5h3.5v1H12v2h2v1h-2v2h2.5v1H11V4.5z" />',
  pageBreak: '<path d="M3 4.5h12v1H3zM7.5 6l4 3-4 3V6zM3 13.5h12v1H3z" />',
  horizontalRule: '<path d="M3 8h12v1H3z" />',
  alignLeft: '<path d="M3 5h12v1H3zM3 8h8v1H3zM3 11h12v1H3z" />',
  alignCenter: '<path d="M3 5h12v1H3zM5 8h8v1H5zM3 11h12v1H3z" />',
  alignRight: '<path d="M3 5h12v1H3zM7 8h8v1H7zM3 11h12v1H3z" />',
  alignJustify: '<path d="M3 5h12v1H3zM3 8h12v1H3zM3 11h12v1H3z" />',
  undo: '<path d="M7 4l-4 4 4 4V10a3 3 0 013 3v1h1.2v-1a4.2 4.2 0 00-4.2-4.2V4z" />',
  redo: '<path d="M11 4v1.8A4.2 4.2 0 0115.2 10v1H16.5v-1a3 3 0 00-3-3V4l-4 4 4 4z" />',
  clearFormat: '<path d="M3 12.5l2-6h1.2l2 6h-1.2l-.4-1.2H4.8L4.4 12.5H3zm2.4-2.2h2l-1-3-1 3zM9.5 4l1.5 1.5 2.5-2.5 1 1-2.5 2.5 2.5 2.5-1 1-2.5-2.5-1.5 1.5V4z" />',
  color: '<path d="M8 3a5 5 0 015 5c0 2.8-2.5 4.9-5 6.5C5.5 12.9 3 10.8 3 8a5 5 0 015-5zm0 1.2A3.8 3.8 0 004.2 8c0 1.8 1.5 3.3 3.8 4.8 2.3-1.5 3.8-3 3.8-4.8A3.8 3.8 0 008 4.2z" />',
  background: '<path d="M3 4h12v7H3zM3 12h12v1.5H3zM7 6h2v2H7z" />',
  more: '<path d="M4 8a1.2 1.2 0 112.4 0 1.2 1.2 0 01-2.4 0zM8 8a1.2 1.2 0 112.4 0 1.2 1.2 0 01-2.4 0zM12 8a1.2 1.2 0 112.4 0 1.2 1.2 0 01-2.4 0z" />',
};

const ICON_VIEWBOX: Record<IconName, string> = {
  bold: "0 0 16 16",
  italic: "0 0 16 16",
  underline: "0 0 16 16",
  strike: "0 0 16 16",
  code: "0 0 16 16",
  heading1: "0 0 16 16",
  heading2: "0 0 16 16",
  heading3: "0 0 16 16",
  quote: "0 0 16 16",
  ul: "0 0 16 16",
  ol: "0 0 16 16",
  link: "0 0 16 16",
  image: "0 0 16 16",
  table: "0 0 16 16",
  variable: "0 0 16 16",
  equation: "0 0 16 16",
  pageBreak: "0 0 16 16",
  horizontalRule: "0 0 16 16",
  alignLeft: "0 0 16 16",
  alignCenter: "0 0 16 16",
  alignRight: "0 0 16 16",
  alignJustify: "0 0 16 16",
  undo: "0 0 16 16",
  redo: "0 0 16 16",
  clearFormat: "0 0 16 16",
  color: "0 0 16 16",
  background: "0 0 16 16",
  more: "0 0 16 16",
};

/**
 * Render an icon to an inline SVG string.
 * Color is applied via the `color` CSS property (currentColor) so parent themes can override it.
 * Pass `color: "var(--pde-color-primary)"` or any CSS color to customize.
 */
export function getIconSvg(name: IconName, opts: IconOptions = {}): string {
  const path = ICON_PATHS[name];
  if (!path) throw new Error(`Unknown icon: ${name}`);
  const size = opts.size ?? 16;
  const color = opts.color ?? "currentColor";
  const strokeWidth = opts.strokeWidth ?? 1.5;
  const klass = ["pde-icon", `pde-icon--${name}`, opts.className].filter(Boolean).join(" ");
  const title = opts.title ? `<title>${escapeHtml(opts.title)}</title>` : "";
  const viewBox = ICON_VIEWBOX[name] ?? "0 0 16 16";
  // Use fill="currentColor" for solid icons; stroke for outline icons — we normalize to fill for simplicity
  // The outer SVG sets color via style, inner paths use fill="currentColor"
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${viewBox}" role="img" aria-hidden="${opts.title ? "false" : "true"}" class="${klass}" style="color:${escapeAttr(color)}" fill="currentColor" stroke="none" stroke-width="${strokeWidth}">${title}${path}</svg>`;
}

/**
 * Return all icons as a map — useful for previews, docs or runtime registration.
 */
export function getAllIcons(opts: IconOptions = {}): Record<IconName, string> {
  const out = {} as Record<IconName, string>;
  for (const name of Object.keys(ICON_PATHS) as IconName[]) out[name] = getIconSvg(name, opts);
  return out;
}

/**
 * CSS helper for icon theming — ensures icons inherit color and can be recolored via variables.
 */
export const iconCss = `
.pde-icon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
  color: var(--pde-icon-color, currentColor);
}
.pde-toolbar .pde-icon {
  color: var(--pde-color-text, #17191c);
}
.pde-toolbar button:hover .pde-icon,
.pde-toolbar button[aria-pressed="true"] .pde-icon {
  color: var(--pde-color-primary, #3659e3);
}
.pde-toolbar button:disabled .pde-icon {
  color: var(--pde-color-muted, #667085);
  opacity: 0.5;
}
`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
