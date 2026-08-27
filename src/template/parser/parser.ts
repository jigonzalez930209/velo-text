/**
 * Parser de variables — Fase 3.1
 * Gramática mínima:
 * variable = "{{", ws, path, [ws, "|", ws, format], [ws, "??", ws, string], ws, "}}"
 * path = identifier, { ".", identifier | "[", integer, "]" }
 */

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*/;
const WS_RE = /^\s*/;
const FORBIDDEN_PATHS = new Set(["__proto__", "prototype", "constructor"]);

export interface ParseSuccess {
  ok: true;
  path: string;
  format?: string;
  fallback?: string;
  source: string;
  valueType: "unknown";
}

export interface ParseFailure {
  ok: false;
  errors: Array<{ code: string; message: string; pos?: number }>;
  path?: string;
  format?: string;
  fallback?: string;
  source: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

export interface VariableToken {
  type: "variable";
  source: string;
  path: string;
  format?: string;
  fallback?: string;
}
export interface TextToken {
  type: "text";
  text: string;
}
export type InlineToken = VariableToken | TextToken;

export function parseVariableSource(source: string): ParseResult {
  const errors: ParseFailure["errors"] = [];
  if (!source.startsWith("{{") || !source.endsWith("}}")) {
    return { ok: false, errors: [{ code: "missing-braces", message: "must start with {{ and end with }}" }], source };
  }
  let inner = source.slice(2, -2);
  let pos = 0;

  function skipWs(): void {
    const m = inner.slice(pos).match(WS_RE);
    if (m) pos += m[0].length;
  }

  skipWs();
  let path = "";
  while (pos < inner.length) {
    const remaining = inner.slice(pos);
    if (remaining.startsWith("|") || remaining.startsWith("??") || remaining.trim() === "") break;
    if (remaining[0] === ".") {
      path += ".";
      pos++;
      continue;
    }
    if (remaining[0] === "[") {
      const m = remaining.match(/^\[(\d+)\]/);
      if (!m) {
        errors.push({ code: "invalid-index", message: "invalid array index", pos });
        break;
      }
      path += m[0];
      pos += m[0].length;
      continue;
    }
    const m = remaining.match(IDENT_RE);
    if (m) {
      path += m[0];
      pos += m[0].length;
      continue;
    }
    break;
  }
  path = path.trim();
  if (!path) errors.push({ code: "missing-path", message: "missing variable path" });
  else if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*|\[\d+\])*$/.test(path)) {
    errors.push({ code: "invalid-path", message: `invalid path ${path}` });
  }
  if (path.split(/[.\[]/).some((p) => FORBIDDEN_PATHS.has(p))) {
    errors.push({ code: "forbidden-path", message: "prototype pollution path forbidden" });
  }
  skipWs();
  let format: string | undefined;
  if (inner.slice(pos).startsWith("|")) {
    pos++;
    skipWs();
    const m = inner.slice(pos).match(IDENT_RE);
    if (!m) errors.push({ code: "missing-format", message: "missing format identifier" });
    else {
      format = m[0];
      pos += m[0].length;
      if (inner[pos] === ":") {
        pos++;
        let arg = "";
        const idx = inner.indexOf("??", pos);
        if (idx !== -1) {
          arg = inner.slice(pos, idx).trim();
          pos = idx;
          format = `${format}:${arg}`;
        } else {
          arg = inner.slice(pos).trim();
          pos = inner.length;
          if (arg) format = `${format}:${arg}`;
        }
        skipWs();
      }
    }
    skipWs();
  }
  let fallback: string | undefined;
  if (inner.slice(pos).startsWith("??")) {
    pos += 2;
    skipWs();
    const rem = inner.slice(pos).trim();
    if ((rem.startsWith('"') && rem.endsWith('"')) || (rem.startsWith("'") && rem.endsWith("'"))) {
      fallback = rem.slice(1, -1);
      pos = inner.length;
    } else {
      fallback = rem;
      pos = inner.length;
    }
  }
  skipWs();
  if (pos !== inner.length) {
    const tail = inner.slice(pos).trim();
    if (tail) errors.push({ code: "trailing", message: `unexpected trailing "${tail}"` });
  }
  if (errors.length > 0) return { ok: false, errors, path: path || undefined, format, fallback, source };
  return { ok: true, path, format, fallback, source, valueType: "unknown" };
}

export function tokenizeVariablesInText(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const re = /\{\{[\s\S]*?\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: "text", text: text.slice(last, m.index) });
    const src = m[0];
    const parsed = parseVariableSource(src);
    if (parsed.ok) tokens.push({ type: "variable", source: src, path: parsed.path, format: parsed.format, fallback: parsed.fallback });
    else tokens.push({ type: "text", text: src });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: "text", text: text.slice(last) });
  return tokens;
}
