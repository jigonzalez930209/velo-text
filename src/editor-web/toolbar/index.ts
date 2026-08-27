/**
 * Toolbar — Phase 7.3
 * Commands with canExecute/execute and icon association.
 * Icons are inline SVGs using currentColor so they can be recolored via CSS variables.
 */
import type { IconName } from "../../assets/icons/index.js";

export interface CommandDef {
  id: string;
  label: string;
  icon?: IconName;
  canExecute: (ctx: unknown) => boolean;
  execute: (ctx: unknown, payload?: unknown) => unknown;
}

const registry = new Map<string, CommandDef>();

export function registerCommand(def: CommandDef): void {
  registry.set(def.id, def);
}

export function getCommand(id: string): CommandDef | undefined {
  return registry.get(id);
}

export function listCommands(): CommandDef[] {
  return [...registry.values()];
}

// Base commands with icons (all SVGs are bundled, color via currentColor)
registerCommand({ id: "text.toggleBold", label: "Bold", icon: "bold", canExecute: () => true, execute: () => ({ mark: "bold" }) });
registerCommand({ id: "text.toggleItalic", label: "Italic", icon: "italic", canExecute: () => true, execute: () => ({ mark: "italic" }) });
registerCommand({ id: "text.toggleUnderline", label: "Underline", icon: "underline", canExecute: () => true, execute: () => ({ mark: "underline" }) });
registerCommand({ id: "text.toggleStrike", label: "Strikethrough", icon: "strikethrough", canExecute: () => true, execute: () => ({ mark: "strike" }) });
registerCommand({ id: "text.toggleCode", label: "Code", icon: "code", canExecute: () => true, execute: () => ({ mark: "code" }) });
registerCommand({ id: "text.clearFormat", label: "Clear formatting", icon: "clearFormat", canExecute: () => true, execute: () => ({}) });
registerCommand({ id: "heading.toggle1", label: "Heading 1", icon: "heading1", canExecute: () => true, execute: () => ({ level: 1 }) });
registerCommand({ id: "heading.toggle2", label: "Heading 2", icon: "heading2", canExecute: () => true, execute: () => ({ level: 2 }) });
registerCommand({ id: "quote.toggle", label: "Quote", icon: "quote", canExecute: () => true, execute: () => ({}) });
registerCommand({ id: "list.toggleUl", label: "Bullet list", icon: "listUnordered", canExecute: () => true, execute: () => ({ kind: "unordered" }) });
registerCommand({ id: "list.toggleOl", label: "Ordered list", icon: "listOrdered", canExecute: () => true, execute: () => ({ kind: "ordered" }) });
registerCommand({ id: "link.insert", label: "Insert link", icon: "link", canExecute: () => true, execute: (_ctx, p) => p });
registerCommand({ id: "variable.insert", label: "Insert variable", icon: "variable", canExecute: () => true, execute: (_ctx, p) => p });
registerCommand({ id: "equation.insert", label: "Insert equation", icon: "equation", canExecute: () => true, execute: (_ctx, p) => p });
registerCommand({ id: "equation.insertBlock", label: "Insert block equation", icon: "equation", canExecute: () => true, execute: (_ctx, p) => p });
registerCommand({ id: "image.insert", label: "Insert image", icon: "image", canExecute: () => true, execute: (_ctx, p) => p });
registerCommand({ id: "table.insert", label: "Insert table", icon: "table", canExecute: () => true, execute: (_ctx, p) => p });
registerCommand({ id: "table.insertRowAfter", label: "Insert row after", icon: "table", canExecute: () => true, execute: () => ({}) });
registerCommand({ id: "align.left", label: "Align left", icon: "alignLeft", canExecute: () => true, execute: () => ({ align: "left" }) });
registerCommand({ id: "align.center", label: "Align center", icon: "alignCenter", canExecute: () => true, execute: () => ({ align: "center" }) });
registerCommand({ id: "align.right", label: "Align right", icon: "alignRight", canExecute: () => true, execute: () => ({ align: "right" }) });
registerCommand({ id: "document.export", label: "Export", icon: "moreHorizontal", canExecute: () => true, execute: (_ctx, p) => p });
registerCommand({ id: "history.undo", label: "Undo", icon: "undo2", canExecute: () => true, execute: () => ({}) });
registerCommand({ id: "history.redo", label: "Redo", icon: "redo2", canExecute: () => true, execute: () => ({}) });
