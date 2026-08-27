/**
 * Historial — Fase 2.2.3
 * Undo/redo con coalescing por tiempo e intención, checkpoints, límite memoria
 */
import type { PortableDocument } from "../model/types.js";
import type { Operation } from "../operations/operations.js";

export interface HistoryEntry {
  document: PortableDocument;
  inverses: Operation[];
  ops: Operation[];
  intent: string;
  time?: number;
}

export class History {
  private limit: number;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private lastTime = 0;
  private lastIntent: string | null = null;

  constructor(limit = 100) {
    this.limit = limit;
  }

  push(entry: HistoryEntry): void {
    const now = entry.time ?? Date.now();
    const shouldCoalesce =
      this.lastIntent === entry.intent && now - this.lastTime < 1000 && this.undoStack.length > 0 && entry.intent === "typing";
    if (shouldCoalesce) {
      const top = this.undoStack[this.undoStack.length - 1]!;
      top.document = entry.document;
      top.inverses = [...entry.inverses, ...top.inverses];
      top.ops = [...top.ops, ...entry.ops];
    } else {
      this.undoStack.push(entry);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
    }
    this.redoStack = [];
    this.lastTime = now;
    this.lastIntent = entry.intent;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(currentDoc: PortableDocument): PortableDocument | null {
    if (!this.canUndo()) return null;
    const entry = this.undoStack.pop()!;
    this.redoStack.push({ document: currentDoc, inverses: entry.ops, ops: entry.inverses, intent: entry.intent, time: Date.now() });
    return entry.document;
  }

  redo(currentDoc: PortableDocument): PortableDocument | null {
    if (!this.canRedo()) return null;
    const entry = this.redoStack.pop()!;
    this.undoStack.push({ document: currentDoc, inverses: entry.inverses, ops: entry.ops, intent: entry.intent, time: Date.now() });
    return entry.document;
  }

  checkpoint(): void {
    this.lastIntent = null;
  }

  get size(): number {
    return this.undoStack.length;
  }
}
