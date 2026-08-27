/**
 * Resolver seguro — Fase 3.2.1/3.2.2
 * Lectura de propiedades propias, bloqueo de prototipos, límites, formatters
 */
import type { PortableDocument } from "../../core/model/types.js";
import type { ParseResult } from "../parser/parser.js";

const FORBIDDEN = new Set<string>(["__proto__", "prototype", "constructor"]);
const MAX_DEPTH = 10;
const MAX_VALUE_LENGTH = 10_000;

export type ResolveResult = { found: true; value: unknown } | { found: false; error?: string };

export function safeResolve(data: unknown, path: string): ResolveResult {
  if (typeof path !== "string") return { found: false };
  const parts: Array<string | number> = [];
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    if (m[1]) parts.push(m[1]);
    else if (m[2]) parts.push(Number(m[2]));
  }
  if (parts.length > MAX_DEPTH) return { found: false, error: "depth-exceeded" };
  if (parts.some((p) => typeof p === "string" && FORBIDDEN.has(p))) return { found: false, error: "forbidden" };
  let cur: unknown = data;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return { found: false };
    if (!Object.prototype.hasOwnProperty.call(cur as Record<string, unknown>, String(p))) return { found: false };
    cur = (cur as Record<string, unknown>)[String(p)];
  }
  return { found: true, value: cur };
}

export function formatValue(value: unknown, format: string | undefined, locale = "es-AR", timezone = "America/Argentina/Buenos_Aires"): string {
  if (!format) {
    if (value == null) return "";
    const str = String(value);
    return str.length > MAX_VALUE_LENGTH ? str.slice(0, MAX_VALUE_LENGTH) : str;
  }
  const [name, arg] = format.split(":");
  try {
    switch (name) {
      case "currency": {
        const cur = arg ?? "ARS";
        const nf = new Intl.NumberFormat(locale, { style: "currency", currency: cur });
        return nf.format(Number(value));
      }
      case "number": {
        const nf = new Intl.NumberFormat(locale);
        return nf.format(Number(value));
      }
      case "percent": {
        const nf = new Intl.NumberFormat(locale, { style: "percent" });
        return nf.format(Number(value));
      }
      case "date": {
        const d = value instanceof Date ? value : new Date(value as string);
        if (Number.isNaN(d.getTime())) return String(value);
        if (arg) {
          const dd = String(d.getDate()).padStart(2, "0");
          const MM = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = String(d.getFullYear());
          if (arg === "dd/MM/yyyy") return `${dd}/${MM}/${yyyy}`;
          if (arg === "yyyy-MM-dd") return `${yyyy}-${MM}-${dd}`;
        }
        return new Intl.DateTimeFormat(locale, { timeZone: timezone }).format(d);
      }
      case "upper":
        return String(value).toUpperCase();
      case "lower":
        return String(value).toLowerCase();
      default:
        return String(value);
    }
  } catch {
    return String(value);
  }
}

export interface RenderOptions {
  mode?: "strict" | "tolerant";
  locale?: string;
  timezone?: string;
  missing?: "error" | "empty" | "keep";
}

export interface RenderResult {
  document: PortableDocument;
  diagnostics: Array<{ path?: string; code: string; severity: "error" | "warn" | "info"; message?: string }>;
  usedVariables: string[];
  unusedVariables: string[];
  hash: string | null;
}

export function renderTemplate(document: PortableDocument, data: Record<string, unknown>, options: RenderOptions = {}): RenderResult {
  const { mode = "strict", locale = "es-AR", timezone = "America/Argentina/Buenos_Aires", missing = "error" } = options;
  const copy: PortableDocument = JSON.parse(JSON.stringify(document));
  const diagnostics: RenderResult["diagnostics"] = [];
  const used = new Set<string>();
  const unused = new Set<string>(Object.keys(data));

  function walkBlocks(blocks: PortableDocument["root"]["children"]): void {
    for (const block of blocks) walkBlock(block as unknown as Record<string, unknown>);
  }

  function walkBlock(block: Record<string, unknown>): void {
    const type = block.type as string;
    if (type === "paragraph" || type === "heading" || type === "quote") {
      const children = block.children as Array<Record<string, unknown>>;
      const out: Array<Record<string, unknown>> = [];
      for (const inline of children ?? []) {
        if (inline.type === "variable") {
          const v = inline as unknown as { id: string; path: string; source: string; format?: string; fallback?: string; marks?: unknown; valueType: string };
          const res = safeResolve(data, v.path);
          used.add(v.path);
          unused.delete(v.path.split(".")[0]!);
          if (!res.found) {
            if (v.fallback !== undefined) {
              out.push({ type: "text", id: `${v.id}_fb`, text: v.fallback, marks: v.marks });
              diagnostics.push({ path: v.path, code: "fallback-used", severity: "info" });
            } else if (missing === "error") {
              diagnostics.push({ path: v.path, code: "missing-variable", severity: "error", message: `missing ${v.path}` });
              if (mode === "strict") throw new Error(`missing variable ${v.path}`);
              out.push({ type: "text", id: `${v.id}_miss`, text: `{{${v.path}}}`, marks: v.marks });
            } else {
              out.push({ type: "text", id: `${v.id}_empty`, text: "", marks: v.marks });
            }
          } else {
            const formatted = formatValue(res.value, v.format, locale, timezone);
            if (formatted.length > MAX_VALUE_LENGTH) diagnostics.push({ path: v.path, code: "value-too-long", severity: "warn" });
            out.push({ type: "text", id: `${v.id}_val`, text: formatted.slice(0, MAX_VALUE_LENGTH), marks: v.marks });
          }
        } else if (inline.type === "link") {
          const link = inline as unknown as { id: string; href: string; children: Array<Record<string, unknown>> };
          const newChildren: Array<Record<string, unknown>> = [];
          for (const c of link.children) {
            if (c.type === "variable") {
              const v = c as unknown as { id: string; path: string; format?: string; fallback?: string };
              const res = safeResolve(data, v.path);
              if (!res.found) {
                if (v.fallback !== undefined) newChildren.push({ type: "text", id: `${v.id}_fb`, text: v.fallback });
                else newChildren.push(c);
              } else {
                newChildren.push({ type: "text", id: `${v.id}_val`, text: formatValue(res.value, v.format, locale, timezone) });
              }
            } else newChildren.push(c);
          }
          out.push({ ...inline, children: newChildren });
        } else out.push(inline);
      }
      block.children = out;
    } else if (type === "table") {
      const tbl = block as unknown as {
        columns: unknown[];
        rows: Array<{ id: string; cells: Array<{ id: string; blocks: PortableDocument["root"]["children"] }> }>;
        repeat?: { path: string; alias: string; templateRowId: string; emptyFallback?: boolean };
      };
      if (tbl.repeat) {
        const rep = tbl.repeat;
        const res = safeResolve(data, rep.path);
        if (!res.found || !Array.isArray(res.value)) {
          diagnostics.push({ path: rep.path, code: "repeat-not-array", severity: "error" });
        } else {
          const templateRow = tbl.rows.find((r) => r.id === rep.templateRowId);
          if (!templateRow) diagnostics.push({ code: "template-row-not-found", severity: "error" });
          else {
            const idx = tbl.rows.indexOf(templateRow);
            const limit = 1000;
            const arr = (res.value as unknown[]).slice(0, limit);
            if ((res.value as unknown[]).length > limit) diagnostics.push({ code: "repeat-limit", severity: "error", message: `limit ${limit}` });
            if (arr.length === 0 && !rep.emptyFallback) {
              tbl.rows.splice(idx, 1);
            } else {
              const newRows: typeof tbl.rows = [];
              for (let i = 0; i < arr.length; i++) {
                const item = arr[i];
                const dataWithAlias: Record<string, unknown> = { ...data, [rep.alias]: item, item };
                const newRow: typeof templateRow = JSON.parse(JSON.stringify(templateRow));
                newRow.id = `${templateRow.id}_r${i}`;
                for (const cell of newRow.cells) {
                  cell.id = `${cell.id}_r${i}`;
                  for (const b of cell.blocks) {
                    const bb = b as unknown as Record<string, unknown>;
                    if (bb.children) {
                      const out: Array<Record<string, unknown>> = [];
                      for (const inl of bb.children as Array<Record<string, unknown>>) {
                        if (inl.type === "variable" && typeof (inl as { path: string }).path === "string" && (inl as { path: string }).path.startsWith(`${rep.alias}.`)) {
                          const v = inl as unknown as { id: string; path: string; format?: string; fallback?: string };
                          const subPath = v.path.slice(rep.alias.length + 1);
                          const aliasRes = safeResolve(item, subPath);
                          let val: unknown = aliasRes.found ? aliasRes.value : undefined;
                          let found = aliasRes.found;
                          if (!found) {
                            const alt = safeResolve(dataWithAlias, v.path);
                            found = alt.found;
                            val = found ? (alt as { found: true; value: unknown }).value : undefined;
                          }
                          if (!found) {
                            if (v.fallback !== undefined) out.push({ type: "text", id: `${v.id}_fb`, text: v.fallback });
                            else out.push({ type: "text", id: `${v.id}_miss`, text: "" });
                          } else {
                            out.push({ type: "text", id: `${v.id}_r${i}`, text: formatValue(val, v.format, locale, timezone) });
                          }
                        } else if (inl.type === "variable") {
                          const v = inl as unknown as { id: string; path: string; format?: string; fallback?: string };
                          const r = safeResolve(dataWithAlias, v.path);
                          if (!r.found) {
                            if (v.fallback !== undefined) out.push({ type: "text", id: `${v.id}_fb`, text: v.fallback });
                            else out.push(inl);
                          } else out.push({ type: "text", id: `${v.id}_r${i}`, text: formatValue(r.value, v.format, locale, timezone) });
                        } else out.push(inl);
                      }
                      bb.children = out;
                    }
                  }
                }
                newRows.push(newRow);
              }
              tbl.rows.splice(idx, 1, ...newRows);
            }
          }
        }
      }
      for (const row of tbl.rows) for (const cell of row.cells) walkBlocks(cell.blocks);
    } else if (type === "list") {
      const list = block as unknown as { items: Array<{ id: string; content: Array<Record<string, unknown>>; nested?: unknown }> };
      for (const item of list.items) {
        const fakeBlock: Record<string, unknown> = { type: "paragraph", id: `${item.id}_p`, children: item.content };
        walkBlock(fakeBlock);
        item.content = fakeBlock.children as Array<Record<string, unknown>>;
        if (item.nested) walkBlock(item.nested as Record<string, unknown>);
      }
    }
  }

  try {
    walkBlocks(copy.root.children);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    diagnostics.push({ code: "render-error", severity: "error", message: msg });
    if (mode === "strict") throw e;
  }

  return {
    document: copy,
    diagnostics,
    usedVariables: [...used],
    unusedVariables: [...unused],
    hash: null,
  };
}

export function inspectVariables(doc: PortableDocument): Array<{ id: string; path: string; source: string }> {
  const vars: Array<{ id: string; path: string; source: string }> = [];
  function walk(blocks: PortableDocument["root"]["children"]): void {
    for (const b of blocks) {
      const bb = b as unknown as Record<string, unknown>;
      if (Array.isArray(bb.children)) {
        for (const c of bb.children as Array<Record<string, unknown>>) if (c.type === "variable") vars.push(c as unknown as { id: string; path: string; source: string });
      }
      if (bb.type === "table") {
        const t = b as unknown as { rows: Array<{ cells: Array<{ blocks: PortableDocument["root"]["children"] }> }> };
        for (const r of t.rows) for (const cell of r.cells) walk(cell.blocks);
      }
      if (bb.type === "list") {
        const list = b as unknown as { items: Array<{ content: Array<Record<string, unknown>>; nested?: unknown }> };
        for (const it of list.items) {
          for (const c of it.content) if (c.type === "variable") vars.push(c as unknown as { id: string; path: string; source: string });
          if (it.nested) walk([it.nested as unknown as PortableDocument["root"]["children"][number]]);
        }
      }
    }
  }
  walk(doc.root.children);
  return vars;
}
