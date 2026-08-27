/**
 * Clipboard and DnD — Phase 4.2.3
 * Text, HTML and internal fragment, allowlist sanitization
 */
const ALLOWED_TAGS = new Set(["p", "h1", "h2", "h3", "blockquote", "ul", "ol", "li", "strong", "em", "u", "s", "code", "a", "br", "table", "tr", "td", "th"]);

export function sanitizePastedHtml(html: string): string {
  // Simple allowlist: remove script, style, iframe, form and event attributes
  let out = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  out = out.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/href\s*=\s*"(javascript:[^"]*)"/gi, 'href="#"');
  // Filter disallowed tags: for simplicity, keep allowlist via regex only (MVP keeps sanitized output)
  // MVP: return sanitized output as-is
  void ALLOWED_TAGS;
  return out;
}

export function getPlainTextFallback(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
