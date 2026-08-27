/**
 * Toolbar — Fase 7.3
 * Comandos canExecute/execute
 */
export interface CommandDef {
  id: string;
  label: string;
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

// Comandos base
registerCommand({ id: "text.toggleBold", label: "Negrita", canExecute: () => true, execute: () => ({ mark: "bold" }) });
registerCommand({ id: "text.toggleItalic", label: "Cursiva", canExecute: () => true, execute: () => ({ mark: "italic" }) });
registerCommand({ id: "variable.insert", label: "Insertar variable", canExecute: () => true, execute: (_ctx, p) => p });
registerCommand({ id: "table.insertRowAfter", label: "Insertar fila debajo", canExecute: () => true, execute: () => ({}) });
registerCommand({ id: "image.insert", label: "Insertar imagen", canExecute: () => true, execute: (_ctx, p) => p });
registerCommand({ id: "document.export", label: "Exportar", canExecute: () => true, execute: (_ctx, p) => p });
