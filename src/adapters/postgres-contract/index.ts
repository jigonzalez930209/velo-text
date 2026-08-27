/**
 * PostgreSQL contract — Phase 10.1
 * Document repository: create, get, update, list revisions and restore. Optimistic concurrency.
 */
import type { PortableDocument } from "../../core/model/types.js";

export interface DocumentRecord {
  id: string;
  tenantId: string;
  title: string;
  schemaVersion: number;
  currentRevision: number;
  content: PortableDocument;
  contentHash: Uint8Array;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRepository {
  create(doc: PortableDocument, tenantId: string, opts?: { idempotencyKey?: string }): Promise<DocumentRecord>;
  get(id: string, tenantId: string): Promise<DocumentRecord | null>;
  update(id: string, tenantId: string, expectedRevision: number, doc: PortableDocument, opts?: { idempotencyKey?: string }): Promise<DocumentRecord>;
  listRevisions(id: string, tenantId: string): Promise<DocumentRecord[]>;
  restore(id: string, tenantId: string, revision: number): Promise<DocumentRecord>;
  /** Keyset pagination — Phase 10.1.3 */
  listDocuments(
    tenantId: string,
    opts?: { limit?: number; cursor?: string; orderBy?: "updatedAt" | "createdAt" },
  ): Promise<{ documents: DocumentRecord[]; nextCursor?: string }>;
  /** Idempotency support */
  getIdempotency(key: string, tenantId: string): Promise<unknown | null>;
}

// Reference SQL — see migrations/001_init.sql for full schema
export const SQL_MIGRATION = `
-- See migrations/001_init.sql
`;

/**
 * In-memory implementation for tests — respects optimistic concurrency control,
 * idempotency keys, keyset pagination and transaction semantics.
 */
export function createInMemoryRepository(): DocumentRepository {
  const store = new Map<string, DocumentRecord>();
  const revisions = new Map<string, DocumentRecord[]>();
  const idempotency = new Map<string, unknown>();

  const key = (id: string, tenant: string): string => `${tenant}:${id}`;
  const idemKey = (k: string, tenant: string): string => `${tenant}:${k}`;

  return {
    async create(doc, tenantId, opts) {
      if (opts?.idempotencyKey) {
        const existing = idempotency.get(idemKey(opts.idempotencyKey, tenantId));
        if (existing) return existing as DocumentRecord;
      }
      const k = key(doc.id, tenantId);
      if (store.has(k)) throw new Error("already exists");
      const rec: DocumentRecord = {
        id: doc.id,
        tenantId,
        title: (doc.metadata.title as string) ?? "Untitled",
        schemaVersion: doc.schemaVersion,
        currentRevision: doc.revision,
        content: doc,
        contentHash: new Uint8Array(32),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
      store.set(k, rec);
      revisions.set(k, [rec]);
      if (opts?.idempotencyKey) idempotency.set(idemKey(opts.idempotencyKey, tenantId), rec);
      return rec;
    },
    async get(id, tenantId) {
      return store.get(key(id, tenantId)) ?? null;
    },
    async update(id, tenantId, expectedRevision, doc, opts) {
      if (opts?.idempotencyKey) {
        const existing = idempotency.get(idemKey(opts.idempotencyKey, tenantId));
        if (existing) return existing as DocumentRecord;
      }
      const k = key(id, tenantId);
      const cur = store.get(k);
      if (!cur) throw new Error("not found");
      if (cur.currentRevision !== expectedRevision) {
        const err = new Error(`conflict: expected ${expectedRevision} got ${cur.currentRevision}`) as Error & { code: string; currentRevision: number };
        err.code = "CONFLICT";
        err.currentRevision = cur.currentRevision;
        throw err;
      }
      // Simulate transaction: document + revision + document_assets must be atomic
      const next: DocumentRecord = {
        ...cur,
        currentRevision: cur.currentRevision + 1,
        content: { ...doc, revision: cur.currentRevision + 1 },
        updatedAt: new Date().toISOString(),
      };
      // Atomic commit
      store.set(k, next);
      revisions.get(k)!.push(next);
      if (opts?.idempotencyKey) idempotency.set(idemKey(opts.idempotencyKey, tenantId), next);
      return next;
    },
    async listRevisions(id, tenantId) {
      return [...(revisions.get(key(id, tenantId)) ?? [])];
    },
    async restore(id, tenantId, revision) {
      const k = key(id, tenantId);
      const revs = revisions.get(k) ?? [];
      const target = revs.find((r) => r.currentRevision === revision);
      if (!target) throw new Error("revision not found");
      const restored: DocumentRecord = { ...target, currentRevision: store.get(k)!.currentRevision + 1, updatedAt: new Date().toISOString() };
      store.set(k, restored);
      revs.push(restored);
      return restored;
    },
    async listDocuments(tenantId, opts = {}) {
      const limit = opts.limit ?? 20;
      const orderBy = opts.orderBy ?? "updatedAt";
      const all = [...store.values()].filter((r) => r.tenantId === tenantId).sort((a, b) => b[orderBy].localeCompare(a[orderBy]));
      let start = 0;
      if (opts.cursor) {
        const idx = all.findIndex((r) => r.id === opts.cursor);
        if (idx !== -1) start = idx + 1;
      }
      const sliced = all.slice(start, start + limit);
      const nextCursor = all.length > start + limit ? sliced[sliced.length - 1]!.id : undefined;
      return { documents: sliced, nextCursor };
    },
    async getIdempotency(keyStr, tenantId) {
      return idempotency.get(idemKey(keyStr, tenantId)) ?? null;
    },
  };
}
