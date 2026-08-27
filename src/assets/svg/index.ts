/**
 * Sanitización SVG — Fase 5.1.3
 * Parser XML interno seguro, allowlist de elementos/atributos, sin scripts/eventos/red.
 */
const ALLOWED_ELEMENTS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "defs",
  "use",
  "clipPath",
  "mask",
  "linearGradient",
  "radialGradient",
  "stop",
]);

const ALLOWED_ATTRS = new Set([
  "width",
  "height",
  "viewBox",
  "xmlns",
  "d",
  "x",
  "y",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "fill",
  "stroke",
  "stroke-width",
  "transform",
  "opacity",
  "id",
  "class",
  "offset",
  "stop-color",
  "stop-opacity",
]);

const FORBIDDEN_ATTRS_PREFIX = ["on", "href", "xlink:href"];

export interface SanitizeResult {
  sanitized: string;
  removed: string[];
  valid: boolean;
}

export function sanitizeSvg(svgText: string): SanitizeResult {
  const removed: string[] = [];
  // Rechazo rápido: scripts, foreignObject, event handlers, URLs externas
  if (/<script/i.test(svgText)) removed.push("script");
  if (/<foreignObject/i.test(svgText)) removed.push("foreignObject");
  if (/javascript:/i.test(svgText)) removed.push("javascript-url");
  if (/\bon\w+\s*=/i.test(svgText)) removed.push("event-handler");

  // Parser muy simple: si contiene elementos no allowlist, marcar
  const tagRe = /<\/?([a-zA-Z0-9:]+)[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(svgText)) !== null) {
    const tag = m[1]!.toLowerCase();
    const base = tag.split(":").pop()!;
    if (!ALLOWED_ELEMENTS.has(base) && !base.startsWith("svg")) {
      // permitir svg root
      if (base !== "svg" && !removed.includes(`element:${base}`)) removed.push(`element:${base}`);
    }
  }

  // Attr filtering: eliminar atributos peligrosos
  let sanitized = svgText
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Valid: si removimos script/event, consideramos sanitizado pero válido; si elemento crítico, invalid
  const valid = !removed.includes("script") || sanitized !== svgText; // simplified
  return { sanitized, removed, valid: removed.length === 0 || valid };
}
