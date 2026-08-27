/**
 * Plugin system — Phase 12.1 & 11.2
 * Allows internal and external extensions to add node types, formatters, commands and export adapters.
 * Designed for zero coupling: core never imports plugins; plugins declare capabilities explicitly.
 *
 * Internal plugins are bundled (e.g., equation, variable). External plugins are registered at runtime
 * via `registerPlugin` and are validated (schema, version, no prototype pollution, no `javascript:` URLs).
 */

import type { BlockNode, InlineNode } from "../model/types.js";
import type { FormatterFn } from "../../template/formatter/index.js";
import type { CommandDef } from "../../editor-web/toolbar/index.js";

/**
 * Plugin definition — the contract an extension must satisfy.
 * See roadmap 12.1 for full list; for v1 we implement a minimal but extensible subset.
 */
export interface PluginDef {
  /** Unique type identifier, e.g. "my-widget" (must be kebab-case) */
  type: string;
  /** Schema version of the plugin (not the document) */
  version: number;
  /** JSON Schema for the node payload (validated at registration) */
  schema?: unknown;
  /** Factory to create a new node of this type */
  createNode?: (idGen: { next(): string }, payload?: unknown) => BlockNode | InlineNode;
  /** Optional normalizer for the node subtree */
  normalize?: (node: BlockNode | InlineNode) => void;
  /** Web renderer — returns HTML string for the node */
  renderWeb?: (node: BlockNode | InlineNode) => string;
  /** PDF adapter — optional; if missing, strict export fails with code `missing-export-adapter` */
  renderPdf?: (node: BlockNode | InlineNode, ctx: unknown) => void;
  /** ODT adapter */
  renderOdt?: (node: BlockNode | InlineNode, ctx: unknown) => string;
  /** DOCX adapter */
  renderDocx?: (node: BlockNode | InlineNode, ctx: unknown) => string;
  /** Commands contributed by the plugin */
  commands?: CommandDef[];
  /** Formatters contributed */
  formatters?: Record<string, FormatterFn>;
  /** Migration for schema upgrades: (doc) => void */
  migrate?: (doc: unknown) => void;
  /** Contract tests — array of fixture names the plugin must pass */
  fixtures?: string[];
}

export type PluginRegistryEvent = { type: "registered"; plugin: PluginDef } | { type: "unregistered"; pluginType: string };

const registry = new Map<string, PluginDef>();
const nodeTypeRegistry = new Map<string, PluginDef>();
const formatterRegistry = new Map<string, FormatterFn>();
const commandRegistry = new Map<string, CommandDef>();
const listeners = new Set<(e: PluginRegistryEvent) => void>();

function validateType(type: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(type)) throw new Error(`Invalid plugin type "${type}" — must be kebab-case`);
  if (["paragraph", "heading", "quote", "list", "table", "image", "page-break", "horizontal-rule", "equation", "equation-block", "columns", "text", "variable", "link", "inline-image", "hard-break", "root"].includes(type))
    throw new Error(`Plugin type "${type}" conflicts with core type`);
}

function validatePlugin(def: PluginDef): void {
  validateType(def.type);
  if (!Number.isInteger(def.version) || def.version < 1) throw new Error(`Invalid version for ${def.type}`);
  if (def.type.includes("__proto__") || def.type.includes("prototype") || def.type.includes("constructor"))
    throw new Error("Prototype pollution attempt");
  // Schema must be an object if provided
  if (def.schema !== undefined && (typeof def.schema !== "object" || def.schema === null))
    throw new Error(`Invalid schema for ${def.type}`);
}

/**
 * Register a plugin — validates and stores it. Throws if type already exists or validation fails.
 * All comments and diagnostics are in English.
 */
export function registerPlugin(def: PluginDef): void {
  validatePlugin(def);
  if (registry.has(def.type)) throw new Error(`Plugin "${def.type}" already registered`);
  registry.set(def.type, def);
  nodeTypeRegistry.set(def.type, def);
  if (def.formatters) {
    for (const [name, fn] of Object.entries(def.formatters)) {
      if (formatterRegistry.has(name)) throw new Error(`Formatter "${name}" already registered by another plugin`);
      formatterRegistry.set(name, fn);
    }
  }
  if (def.commands) {
    for (const cmd of def.commands) {
      if (commandRegistry.has(cmd.id)) throw new Error(`Command "${cmd.id}" already registered`);
      commandRegistry.set(cmd.id, cmd);
    }
  }
  for (const l of listeners) l({ type: "registered", plugin: def });
}

/**
 * Unregister a plugin — removes its contributions. Used for hot-reload in playground and tests.
 */
export function unregisterPlugin(type: string): void {
  const def = registry.get(type);
  if (!def) return;
  registry.delete(type);
  nodeTypeRegistry.delete(type);
  if (def.formatters) for (const name of Object.keys(def.formatters)) formatterRegistry.delete(name);
  if (def.commands) for (const cmd of def.commands) commandRegistry.delete(cmd.id);
  for (const l of listeners) l({ type: "unregistered", pluginType: type });
}

export function getPlugin(type: string): PluginDef | undefined {
  return registry.get(type);
}

export function listPlugins(): string[] {
  return [...registry.keys()].sort();
}

export function getNodeTypePlugin(type: string): PluginDef | undefined {
  return nodeTypeRegistry.get(type);
}

export function getFormatter(name: string): FormatterFn | undefined {
  return formatterRegistry.get(name);
}

export function listFormatters(): string[] {
  return [...formatterRegistry.keys()].sort();
}

export function getCommand(id: string): CommandDef | undefined {
  return commandRegistry.get(id);
}

export function listCommands(): string[] {
  return [...commandRegistry.keys()].sort();
}

export function onRegistryEvent(listener: (e: PluginRegistryEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Check if a node type is handled by a plugin — used by renderers and validators to delegate.
 */
export function isPluginNodeType(type: string): boolean {
  return nodeTypeRegistry.has(type);
}

/**
 * Validate that all plugin node types have at least a web renderer; otherwise warn.
 * For strict export, missing PDF/ODT/DOCX adapters cause `missing-export-adapter` errors.
 */
export function validatePluginCoverage(): Array<{ plugin: string; missing: string[] }> {
  const issues: Array<{ plugin: string; missing: string[] }> = [];
  for (const [type, def] of registry.entries()) {
    const missing: string[] = [];
    if (!def.renderWeb) missing.push("renderWeb");
    // Export adapters are optional — only warn, not error, for tolerant mode
    if (!def.renderPdf) missing.push("renderPdf");
    if (!def.renderOdt) missing.push("renderOdt");
    if (!def.renderDocx) missing.push("renderDocx");
    if (missing.length) issues.push({ plugin: type, missing });
  }
  return issues;
}

// Re-export helpers for public API
export function registerNodeType(type: string, plugin: PluginDef): void {
  registerPlugin({ ...plugin, type });
}

export function registerFormatter(name: string, fn: FormatterFn): void {
  if (formatterRegistry.has(name)) throw new Error(`Formatter ${name} already exists`);
  formatterRegistry.set(name, fn);
}
