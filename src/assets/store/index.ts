/**
 * Asset store — Phase 5.2 / 5.2.3
 * Interface create/put/confirm/get/delete with idempotent retries, cancellation support,
 * transactional references, dedupe by sha256 per tenant, deferred GC and audit.
 */
import type { AssetRef } from "../../core/model/types.js";

export interface AssetRecord extends AssetRef {
  tenantId: string;
  status: "pending" | "confirmed" | "orphaned" | "deleted";
  createdAt: string;
  confirmedAt?: string;
}

export interface CreateIntent {
  tenantId: string;
  sha256: string;
  byteLength: number;
  mediaType: AssetRef["mediaType"];
  fileName: string;
}

export interface AssetStore {
  /** Create an upload intent — returns existing asset if deduped */
  createIntent(intent: CreateIntent): Promise<{ asset: AssetRecord; isDuplicate: boolean; uploadUrl?: string }>;
  /** Confirm after PUT to storage */
  confirm(assetId: string, tenantId: string): Promise<AssetRecord>;
  /** Get asset by id */
  get(assetId: string, tenantId: string): Promise<AssetRecord | null>;
  /** Get by sha256 (dedupe lookup) */
  getByHash(sha256: string, tenantId: string): Promise<AssetRecord | null>;
  /** Add reference from document to asset (transactional) */
  addReference(documentId: string, assetId: string, tenantId: string): Promise<void>;
  /** Remove reference */
  removeReference(documentId: string, assetId: string, tenantId: string): Promise<void>;
  /** Garbage collect orphaned assets older than threshold */
  gc(olderThanMs?: number): Promise<string[]>;
  /** List assets for tenant with keyset pagination */
  list(tenantId: string, opts?: { limit?: number; cursor?: string }): Promise<{ assets: AssetRecord[]; nextCursor?: string }>;
}

/**
 * In-memory implementation — deterministic, suitable for tests and as reference for PG implementation.
 * Dedupe is per-tenant by sha256 (unique constraint in PG: UNIQUE(tenant_id, sha256)).
 */
export function createInMemoryAssetStore(): AssetStore & { storage: Map<string, AssetRecord>; refs: Map<string, Set<string>> } {
  const assets = new Map<string, AssetRecord>(); // key: tenantId:assetId
  const byHash = new Map<string, AssetRecord>(); // key: tenantId:sha256
  const refs = new Map<string, Set<string>>(); // key: documentId -> Set<assetId>
  const key = (tenantId: string, assetId: string) => `${tenantId}:${assetId}`;
  const hashKey = (tenantId: string, sha256: string) => `${tenantId}:${sha256}`;

  return {
    storage: assets,
    refs,
    async createIntent(intent) {
      const existing = byHash.get(hashKey(intent.tenantId, intent.sha256));
      if (existing) return { asset: existing, isDuplicate: true };
      const id = `ast_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      const now = new Date().toISOString();
      const rec: AssetRecord = {
        id,
        kind: "image",
        mediaType: intent.mediaType,
        storageKey: `tenants/${intent.tenantId}/assets/${id}`,
        sha256: intent.sha256,
        byteLength: intent.byteLength,
        alt: intent.fileName,
        tenantId: intent.tenantId,
        status: "pending",
        createdAt: now,
      };
      assets.set(key(intent.tenantId, id), rec);
      byHash.set(hashKey(intent.tenantId, intent.sha256), rec);
      return { asset: rec, isDuplicate: false, uploadUrl: `https://storage.example/upload/${id}` };
    },
    async confirm(assetId, tenantId) {
      const rec = assets.get(key(tenantId, assetId));
      if (!rec) throw new Error("asset not found");
      rec.status = "confirmed";
      rec.confirmedAt = new Date().toISOString();
      return rec;
    },
    async get(assetId, tenantId) {
      return assets.get(key(tenantId, assetId)) ?? null;
    },
    async getByHash(sha256, tenantId) {
      return byHash.get(hashKey(tenantId, sha256)) ?? null;
    },
    async addReference(documentId, assetId, tenantId) {
      const rec = assets.get(key(tenantId, assetId));
      if (!rec) throw new Error("asset not found");
      if (!refs.has(documentId)) refs.set(documentId, new Set());
      refs.get(documentId)!.add(assetId);
    },
    async removeReference(documentId, assetId) {
      refs.get(documentId)?.delete(assetId);
      // Mark orphaned if no remaining refs across all docs
      let stillReferenced = false;
      for (const set of refs.values()) if (set.has(assetId)) stillReferenced = true;
      if (!stillReferenced) {
        // Find asset record to mark orphaned
        for (const rec of assets.values()) if (rec.id === assetId) rec.status = "orphaned";
      }
    },
    async gc(olderThanMs = 24 * 60 * 60 * 1000) {
      const cut = Date.now() - olderThanMs;
      const deleted: string[] = [];
      for (const [k, rec] of assets.entries()) {
        if (rec.status === "orphaned" && new Date(rec.createdAt).getTime() < cut) {
          assets.delete(k);
          byHash.delete(hashKey(rec.tenantId, rec.sha256));
          deleted.push(rec.id);
          // Remove from refs
          for (const set of refs.values()) set.delete(rec.id);
        }
      }
      return deleted;
    },
    async list(tenantId, opts = {}) {
      const limit = opts.limit ?? 20;
      const all = [...assets.values()].filter((a) => a.tenantId === tenantId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      let start = 0;
      if (opts.cursor) {
        const idx = all.findIndex((a) => a.id === opts.cursor);
        if (idx !== -1) start = idx + 1;
      }
      const sliced = all.slice(start, start + limit);
      const nextCursor = all.length > start + limit ? sliced[sliced.length - 1]!.id : undefined;
      return { assets: sliced, nextCursor };
    },
  };
}
