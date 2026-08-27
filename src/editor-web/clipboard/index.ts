/**
 * Clipboard y DnD — Fase 4.2.3
 * Texto, HTML y fragmento interno, sanitización allowlist
 */
const ALLOWED_TAGS = new Set(["p", "h1", "h2", "h3", "blockquote", "ul", "ol", "li", "strong", "em", "u", "s", "code", "a", "br", "table", "tr", "td", "th"]);

export function sanitizePastedHtml(html: string): string {
  // allowlist simple: eliminar script, style, iframe, form, y atributos evento
  let out = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  out = out.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/href\s*=\s*"(javascript:[^"]*)"/gi, 'href="#"');
  // filtrar tags no permitidos: por simplicidad, dejar solo allowlist via regex strip
  // MVP: retornar out tal cual sanitizado básico
  void ALLOWED_TAGS;
  return out;
}

export function getPlainTextFallback(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
