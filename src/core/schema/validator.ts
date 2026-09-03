/**
 * Structural validator — Phase 2.1.2
 * Diagnostics with JSON Pointer, error limit, strict/tolerant modes.
 * Also validates LaTeX equation nodes (simple subset).
 */
import type { PortableDocument, BlockNode, InlineNode } from "../model/types.js";

export interface ValidationError {
  path: string;
  code: string;
  message: string;
  severity: "error" | "warn" | "info";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidateOptions {
  strict?: boolean;
  maxErrors?: number;
}

const MAX_ERRORS = 100;

export function validateDocument(doc: PortableDocument, opts: ValidateOptions = {}): ValidationResult {
  const errors: ValidationError[] = [];
  const strict = opts.strict ?? true;
  const seenIds = new Set<string>();

  function err(path: string, code: string, message: string, severity: ValidationError["severity"] = "error"): void {
    if (errors.length >= (opts.maxErrors ?? MAX_ERRORS)) return;
    errors.push({ path, code, message, severity });
  }

  // envelope
  if ((doc as unknown as Record<string, unknown>).schema !== "portable-doc") err("", "schema-type", `schema must be "portable-doc"`);
  if ((doc as PortableDocument).schemaVersion !== 1) err("/schemaVersion", "schema-version", `unsupported version ${(doc as PortableDocument).schemaVersion}`);
  if (typeof doc.id !== "string" || !doc.id) err("/id", "required", "id required");
  if (typeof doc.revision !== "number") err("/revision", "type", "revision must be number");
  if (!doc.root || doc.root.type !== "root") err("/root", "type", "root must be type root");
  if (doc.root && !Array.isArray(doc.root.children)) err("/root/children", "type", "root.children must be array");

  function checkId(id: string, path: string): void {
    if (typeof id !== "string" || !id) err(path, "id-required", "id required");
    else if (seenIds.has(id)) err(path, "duplicate-id", `duplicate id ${id}`);
    else seenIds.add(id);
  }

  if (doc.root?.id) checkId(doc.root.id, "/root/id");

  const validBlockTypes = new Set<BlockNode["type"]>([
    "paragraph",
    "heading",
    "quote",
    "list",
    "table",
    "image",
    "page-break",
    "horizontal-rule",
    "equation-block",
    "columns",
    "section-break",
  ]);
  const validInlineTypes = new Set<InlineNode["type"]>(["text", "variable", "link", "inline-image", "hard-break", "equation"]);

  function validateInline(node: InlineNode, path: string): void {
    if (!node || typeof (node as unknown as Record<string, unknown>).type !== "string") {
      err(path, "type", "inline node requires type");
      return;
    }
    checkId(node.id, `${path}/id`);
    if (!validInlineTypes.has(node.type as InlineNode["type"])) err(`${path}/type`, "unknown-type", `unknown inline type ${(node as {type:string}).type}`);
    if (node.type === "text") {
      if (typeof node.text !== "string") err(`${path}/text`, "type", "text.text must be string");
    }
    if (node.type === "variable") {
      if (typeof node.path !== "string" || !node.path) err(`${path}/path`, "required", "variable path required");
      else if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*|\[\d+\])*$/.test(node.path)) {
        err(`${path}/path`, "invalid-path", `invalid variable path ${node.path}`);
      }
      if (node.source !== undefined && typeof node.source !== "string") err(`${path}/source`, "type", "source must be string");
    }
    if (node.type === "link") {
      if (typeof node.href !== "string") err(`${path}/href`, "type", "href must be string");
      if (node.href && /^javascript:/i.test(node.href)) err(`${path}/href`, "unsafe-url", "javascript: url forbidden");
      if (Array.isArray(node.children)) node.children.forEach((c, i) => validateInline(c as InlineNode, `${path}/children/${i}`));
    }
    if (node.type === "equation") {
      if (typeof node.latex !== "string" || !node.latex.trim()) err(`${path}/latex`, "required", "equation latex required");
      else {
        if (node.latex.length > 2000) err(`${path}/latex`, "too-long", "equation too long (max 2000 chars)");
        // Simple LaTeX subset allowlist: letters, numbers, \command, {}, ^_, +-=/*, (), [], fractions, sqrt, greek, etc.
        // For v1 we allow most printable except dangerous control sequences like \input, \write, \def, \include.
        const forbidden = ["\\input", "\\write", "\\def", "\\include", "\\catcode", "\\openout", "\\immediate"];
        if (forbidden.some((f) => node.latex.includes(f))) err(`${path}/latex`, "forbidden-command", `forbidden LaTeX command in ${node.latex.slice(0, 30)}`);
        // Balanced braces check (simple)
        let depth = 0;
        for (const ch of node.latex) {
          if (ch === "{") depth++;
          if (ch === "}") depth--;
          if (depth < 0) break;
        }
        if (depth !== 0) err(`${path}/latex`, "unbalanced-braces", "unbalanced braces in LaTeX");
      }
    }
  }

  function validateBlock(node: BlockNode, path: string): void {
    if (!node || typeof (node as unknown as Record<string, unknown>).type !== "string") {
      err(path, "type", "block requires type");
      return;
    }
    checkId(node.id, `${path}/id`);
    if (!validBlockTypes.has(node.type)) err(`${path}/type`, "unknown-type", `unknown block type ${(node as {type:string}).type}`);
    if (node.type === "paragraph" || node.type === "heading" || node.type === "quote") {
      if (!Array.isArray(node.children)) err(`${path}/children`, "type", `${node.type} children must be array`);
      else node.children.forEach((c, i) => validateInline(c, `${path}/children/${i}`));
    }
    if (node.type === "list") {
      if (!Array.isArray(node.items)) err(`${path}/items`, "type", "list items must be array");
      else
        node.items.forEach((it, i) => {
          checkId(it.id, `${path}/items/${i}/id`);
          if (Array.isArray(it.content)) it.content.forEach((c, j) => validateInline(c, `${path}/items/${i}/content/${j}`));
          if (it.nested) validateBlock(it.nested, `${path}/items/${i}/nested`);
        });
    }
    if (node.type === "table") {
      if (!Array.isArray(node.columns)) err(`${path}/columns`, "type", "columns must be array");
      if (!Array.isArray(node.rows)) err(`${path}/rows`, "type", "rows must be array");
      const colCount = node.columns?.length ?? 0;
      node.rows?.forEach((row, ri) => {
        checkId(row.id, `${path}/rows/${ri}/id`);
        if (!Array.isArray(row.cells)) err(`${path}/rows/${ri}/cells`, "type", "cells must be array");
        else {
          let spanSum = 0;
          row.cells.forEach((cell, ci) => {
            checkId(cell.id, `${path}/rows/${ri}/cells/${ci}/id`);
            spanSum += cell.colSpan ?? 1;
            if (Array.isArray(cell.blocks)) cell.blocks.forEach((b, bi) => validateBlock(b, `${path}/rows/${ri}/cells/${ci}/blocks/${bi}`));
          });
          if (spanSum !== colCount && colCount > 0) err(`${path}/rows/${ri}`, "table-span", `row span ${spanSum} != columns ${colCount}`);
        }
      });
      if (node.repeat) {
        if (typeof node.repeat.path !== "string") err(`${path}/repeat/path`, "type", "repeat.path required");
        if (typeof node.repeat.alias !== "string") err(`${path}/repeat/alias`, "type", "repeat.alias required");
        if (typeof node.repeat.templateRowId !== "string") err(`${path}/repeat/templateRowId`, "type", "repeat.templateRowId required");
      }
    }
    if (node.type === "image") {
      if (typeof node.assetId !== "string") err(`${path}/assetId`, "type", "image assetId required");
      if (node.assetId && !doc.assets?.[node.assetId] && strict) err(`${path}/assetId`, "missing-asset", `asset ${node.assetId} not in document.assets`);
    }
    if (node.type === "columns") {
      if (!Array.isArray(node.columns) || node.columns.length < 2) err(`${path}/columns`, "type", "columns requires at least 2 slots");
      else
        node.columns.forEach((col, i) => {
          checkId(col.id, `${path}/columns/${i}/id`);
          if (Array.isArray(col.blocks)) col.blocks.forEach((b, bi) => validateBlock(b, `${path}/columns/${i}/blocks/${bi}`));
        });
    }
    if (node.type === "equation-block") {
      if (typeof node.latex !== "string" || !node.latex.trim()) err(`${path}/latex`, "required", "equation latex required");
      else {
        if (node.latex.length > 2000) err(`${path}/latex`, "too-long", "equation too long (max 2000 chars)");
        const forbidden = ["\\input", "\\write", "\\def", "\\include"];
        if (forbidden.some((f) => node.latex.includes(f))) err(`${path}/latex`, "forbidden-command", "forbidden LaTeX command");
        let depth = 0;
        for (const ch of node.latex) {
          if (ch === "{") depth++;
          if (ch === "}") depth--;
          if (depth < 0) break;
        }
        if (depth !== 0) err(`${path}/latex`, "unbalanced-braces", "unbalanced braces");
      }
    }
    if (node.type === "section-break") {
      const s = (node as unknown as { settings?: Record<string, unknown> }).settings;
      if (s !== undefined && (typeof s !== "object" || s === null)) {
        err(`${path}/settings`, "type", "section settings must be object");
      } else if (s) {
        if (s.orientation !== undefined && s.orientation !== "portrait" && s.orientation !== "landscape") {
          err(`${path}/settings/orientation`, "enum", "orientation must be portrait or landscape");
        }
        if (s.widthUm !== undefined && (typeof s.widthUm !== "number" || s.widthUm <= 0)) {
          err(`${path}/settings/widthUm`, "range", "widthUm must be > 0");
        }
        if (s.heightUm !== undefined && (typeof s.heightUm !== "number" || s.heightUm <= 0)) {
          err(`${path}/settings/heightUm`, "range", "heightUm must be > 0");
        }
        if (s.restartPageNumbering !== undefined && typeof s.restartPageNumbering !== "boolean") {
          err(`${path}/settings/restartPageNumbering`, "type", "restartPageNumbering must be boolean");
        }
        if (s.startPageNumber !== undefined && (typeof s.startPageNumber !== "number" || s.startPageNumber < 1)) {
          err(`${path}/settings/startPageNumber`, "range", "startPageNumber must be >= 1");
        }
        if (s.marginsUm !== undefined) {
          const m = s.marginsUm as Record<string, unknown>;
          if (typeof m !== "object" || m === null) {
            err(`${path}/settings/marginsUm`, "type", "marginsUm must be object");
          } else {
            for (const side of ["top", "right", "bottom", "left"] as const) {
              if (m[side] !== undefined && (typeof m[side] !== "number" || (m[side] as number) < 0)) {
                err(`${path}/settings/marginsUm/${side}`, "range", `${side} margin must be >= 0`);
              }
            }
          }
        }
      }
    }
  }

  if (doc.root?.children) {
    doc.root.children.forEach((b, i) => validateBlock(b, `/root/children/${i}`));
  }

  // assets
  if (doc.assets) {
    for (const [k, a] of Object.entries(doc.assets)) {
      const p = `/assets/${k}`;
      if (a.id !== k) err(`${p}/id`, "asset-id-mismatch", `asset key ${k} != id ${a.id}`);
      if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(a.mediaType as string))
        err(`${p}/mediaType`, "media-type", `unsupported ${a.mediaType}`);
      if (typeof a.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(a.sha256)) err(`${p}/sha256`, "hash", "sha256 must be 64 hex");
      if (typeof a.byteLength !== "number" || a.byteLength < 0) err(`${p}/byteLength`, "type", "byteLength must be >=0");
    }
  }

  // page
  if (doc.page) {
    if (typeof doc.page.widthUm !== "number" || doc.page.widthUm <= 0) err("/page/widthUm", "range", "widthUm >0");
    if (typeof doc.page.heightUm !== "number" || doc.page.heightUm <= 0) err("/page/heightUm", "range", "heightUm >0");
    if (doc.page.headerFooter) {
      const hf = doc.page.headerFooter;
      if (typeof hf !== "object" || hf === null) {
        err("/page/headerFooter", "type", "headerFooter must be object");
      } else {
        if (hf.headerDistanceUm !== undefined && (typeof hf.headerDistanceUm !== "number" || hf.headerDistanceUm < 0)) {
          err("/page/headerFooter/headerDistanceUm", "range", "headerDistanceUm >= 0");
        }
        if (hf.footerDistanceUm !== undefined && (typeof hf.footerDistanceUm !== "number" || hf.footerDistanceUm < 0)) {
          err("/page/headerFooter/footerDistanceUm", "range", "footerDistanceUm >= 0");
        }
        const validateZone = (zone: unknown, zPath: string) => {
          if (!zone || typeof zone !== "object") {
            err(zPath, "type", `${zPath} must be object`);
            return;
          }
          const z = zone as Record<string, unknown>;
          for (const side of ["left", "center", "right"] as const) {
            if (z[side] !== undefined) {
              if (!Array.isArray(z[side])) {
                err(`${zPath}/${side}`, "type", `${side} must be array`);
              } else {
                (z[side] as InlineNode[]).forEach((inNode, idx) => validateInline(inNode, `${zPath}/${side}/${idx}`));
              }
            }
          }
        };

        if (hf.header) validateZone(hf.header, "/page/headerFooter/header");
        if (hf.footer) validateZone(hf.footer, "/page/headerFooter/footer");
        if (hf.firstPageHeader) validateZone(hf.firstPageHeader, "/page/headerFooter/firstPageHeader");
        if (hf.firstPageFooter) validateZone(hf.firstPageFooter, "/page/headerFooter/firstPageFooter");
        if (hf.evenPageHeader) validateZone(hf.evenPageHeader, "/page/headerFooter/evenPageHeader");
        if (hf.evenPageFooter) validateZone(hf.evenPageFooter, "/page/headerFooter/evenPageFooter");
      }
    }
  }

  // depth limit
  function depth(node: unknown, d = 0): void {
    if (d > 20) err("", "depth", "document too deep");
    const n = node as Record<string, unknown>;
    if (Array.isArray(n?.children)) (n.children as unknown[]).forEach((c) => depth(c, d + 1));
    if (Array.isArray(n?.rows))
      for (const r of n.rows as Array<Record<string, unknown>>) {
        for (const c of (r.cells as Array<Record<string, unknown>>) ?? []) {
          for (const b of (c.blocks as unknown[]) ?? []) depth(b, d + 1);
        }
      }
    if (Array.isArray(n?.columns))
      for (const col of n.columns as Array<Record<string, unknown>>) {
        if (Array.isArray(col.blocks)) for (const b of col.blocks) depth(b, d + 1);
      }
  }
  if (doc.root) depth(doc.root);

  function layoutNest(list: unknown[], d: number): void {
    for (const raw of list) {
      const b = raw as { type?: string; rows?: Array<{ cells: Array<{ blocks: unknown[] }> }>; columns?: Array<{ blocks?: unknown[] }> };
      if (b.type === "table" || b.type === "columns") {
        if (d >= 3) err("", "layout-depth", "nested table/columns max depth is 3");
        if (b.type === "table") for (const row of b.rows ?? []) for (const cell of row.cells) layoutNest(cell.blocks, d + 1);
        else for (const col of b.columns ?? []) layoutNest(col.blocks ?? [], d + 1);
      }
    }
  }
  if (doc.root?.children) layoutNest(doc.root.children, 0);

  return { valid: errors.filter((e) => e.severity === "error").length === 0, errors };
}

export function assertValid(doc: PortableDocument, opts?: ValidateOptions): ValidationResult {
  const res = validateDocument(doc, opts);
  if (!res.valid) {
    const msg = res.errors
      .slice(0, 5)
      .map((e) => `${e.path} ${e.code}: ${e.message}`)
      .join("; ");
    throw new Error(`Document invalid: ${msg}`);
  }
  return res;
}
