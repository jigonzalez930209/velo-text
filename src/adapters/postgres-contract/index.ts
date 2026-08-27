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
  create(doc: PortableDocument, tenantId: string): Promise<DocumentRecord>;
  get(id: string, tenantId: string): Promise<DocumentRecord | null>;
  update(id: string, tenantId: string, expectedRevision: number, doc: PortableDocument): Promise<DocumentRecord>;
  listRevisions(id: string, tenantId: string): Promise<DocumentRecord[]>;
  restore(id: string, tenantId: string, revision: number): Promise<DocumentRecord>;
}

// Reference SQL (not executed here, contract only)
export const SQL_MIGRATION = `
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  title text NOT NULL,
  schema_version integer NOT NULL,
  current_revision bigint NOT NULL DEFAULT 0,
  content jsonb NOT NULL,
  content_hash bytea NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at timestamptz,
  UNIQUE (tenant_id, id)
);
CREATE TABLE IF NOT EXISTS document_revisions (
  document_id uuid NOT NULL REFERENCES documents(id),
  revision bigint NOT NULL,
  content jsonb NOT NULL,
  content_hash bytea NOT NULL,
  author_id uuid,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (document_id, revision)
);
`;

/**
 * In-memory implementation for tests — respects optimistic concurrency control
 */
export function createInMemoryRepository(): DocumentRepository {
  const store = new Map<string, DocumentRecord>();
  const revisions = new Map<string, DocumentRecord[]>();

  const key = (id: string, tenant: string): string => `${tenant}:${id}`;

  return {
    async create(doc, tenantId) {
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
      return rec;
    },
    async get(id, tenantId) {
      return store.get(key(id, tenantId)) ?? null;
    },
    async update(id, tenantId, expectedRevision, doc) {
      const k = key(id, tenantId);
      const cur = store.get(k);
      if (!cur) throw new Error("not found");
      if (cur.currentRevision !== expectedRevision) {
        const err = new Error(`conflict: expected ${expectedRevision} got ${cur.currentRevision}`) as Error & { code: string; currentRevision: number };
        err.code = "CONFLICT";
        err.currentRevision = cur.currentRevision;
        throw err;
      }
      const next: DocumentRecord = {
        ...cur,
        currentRevision: cur.currentRevision + 1,
        content: { ...doc, revision: cur.currentRevision + 1 },
        updatedAt: new Date().toISOString(),
      };
      store.set(k, next);
      revisions.get(k)!.push(next);
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
      const restored: DocumentRecord = { ...target, currentRevision: (store.get(k)!.currentRevision + 1), updatedAt: new Date().toISOString() };
      store.set(k, restored);
      revs.push(restored);
      return restored;
    },
  };
}
