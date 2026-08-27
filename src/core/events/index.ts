export type DocEventType = "beforeChange" | "afterChange" | "selectionChange" | "validate";

export interface DocEvent<T = unknown> {
  type: DocEventType;
  payload: T;
  timestamp: string;
}

export type EventHandler<T = unknown> = (e: DocEvent<T>) => void;

export class EventEmitter {
  private handlers = new Map<DocEventType, Set<EventHandler>>();

  on<T>(type: DocEventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler as EventHandler);
    return () => this.handlers.get(type)!.delete(handler as EventHandler);
  }

  emit<T>(type: DocEventType, payload: T): void {
    const set = this.handlers.get(type);
    if (!set) return;
    const ev: DocEvent<T> = { type, payload, timestamp: new Date().toISOString() };
    for (const h of set) h(ev);
  }
}
