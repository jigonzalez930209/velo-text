#!/usr/bin/env node
/**
 * Example: PostgreSQL contract with optimistic concurrency and keyset pagination — Phase 11.2.3
 * Uses in-memory repository (replace with real pg client in production).
 */
import { createDocument, createIdGenerator } from "../dist/public-api/index.js";
import { createInMemoryRepository } from "../dist/adapters/postgres-contract/index.js";

const tenantId = "tenant_123";
const repo = createInMemoryRepository();
const idGen = createIdGenerator("ex");
const clock = { nowIso: () => "2026-08-27T12:00:00.000Z" };

const doc = createDocument({ idGenerator: idGen, clock });
doc.metadata.title = "Contrato";
doc.root.children.push({ type: "paragraph", id: idGen.next(), children: [{ type: "text", id: idGen.next(), text: "Hola mundo" }] });

const created = await repo.create(doc, tenantId, { idempotencyKey: "create-1" });
console.log("created", created.id, "rev", created.currentRevision);

// Update with concurrency control
const nextDoc = { ...doc, root: { ...doc.root, children: [...doc.root.children, { type: "paragraph", id: idGen.next(), children: [{ type: "text", id: idGen.next(), text: "Segunda línea" }] }] } };
const updated = await repo.update(created.id, tenantId, 0, nextDoc, { idempotencyKey: "update-1" });
console.log("updated rev", updated.currentRevision);

// Conflict
try {
  await repo.update(created.id, tenantId, 0, nextDoc);
} catch (e) {
  console.log("expected conflict:", e.message);
}

// Keyset pagination
for (let i = 0; i < 5; i++) {
  const d = createDocument({ idGenerator: createIdGenerator(`p${i}`), clock });
  d.metadata.title = `Doc ${i}`;
  await repo.create(d, tenantId);
}
const page1 = await repo.listDocuments(tenantId, { limit: 3 });
console.log("page1", page1.documents.map((d) => d.title), "next", page1.nextCursor);
if (page1.nextCursor) {
  const page2 = await repo.listDocuments(tenantId, { limit: 3, cursor: page1.nextCursor });
  console.log("page2", page2.documents.map((d) => d.title));
}

const revisions = await repo.listRevisions(created.id, tenantId);
console.log("revisions", revisions.map((r) => r.currentRevision));
