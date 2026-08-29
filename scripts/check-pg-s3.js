#!/usr/bin/env node
/**
 * PG / S3 adapter contract smoke test — Phase 10 & 8
 * Validates in-memory repository and SigV4 URL generation.
 * Skips gracefully if PGHOST is not set.
 */
import fs from "node:fs";
import { createInMemoryRepository } from "../dist/adapters/postgres-contract/index.js";
import { createPresignedUrl } from "../dist/adapters/s3-compatible/index.js";
import { createDocument, createIdGenerator } from "../dist/core/model/factories.js";

async function main() {
  // ---- PG contract (in-memory) ----
  console.log("Testing DocumentRepository contract (in-memory)...");
  const repo = createInMemoryRepository();
  const idGen = createIdGenerator("pg");
  const clock = { nowIso: () => "2026-08-27T12:00:00.000Z" };
  const doc = createDocument({ idGenerator: idGen, clock });
  doc.root.children.push({
    type: "paragraph",
    id: idGen.next(),
    children: [{ type: "text", id: idGen.next(), text: "Hello PG" }],
  });

  const rec = await repo.create(doc, "tenant-1");
  if (!rec || rec.id !== doc.id) throw new Error("Repository create failed");

  const loaded = await repo.get(doc.id, "tenant-1");
  if (!loaded || loaded.id !== doc.id) throw new Error("Repository get failed");

  // Optimistic concurrency
  const updated = await repo.update(doc.id, "tenant-1", rec.currentRevision, doc);
  if (updated.currentRevision !== rec.currentRevision + 1) throw new Error("Revision increment failed");

  let conflictOk = false;
  try {
    await repo.update(doc.id, "tenant-1", rec.currentRevision, doc);
  } catch (e) {
    if (e.code === "CONFLICT") conflictOk = true;
  }
  if (!conflictOk) throw new Error("Optimistic concurrency not enforced");

  const revs = await repo.listRevisions(doc.id, "tenant-1");
  if (revs.length < 2) throw new Error("Revisions not stored");

  const { documents } = await repo.listDocuments("tenant-1");
  if (documents.length !== 1) throw new Error("listDocuments failed");

  console.log("Repository contract OK.");

  // ---- S3 SigV4 ----
  console.log("Testing S3 SigV4 URL generation...");
  const url = await createPresignedUrl(
    {
      endpoint: "http://localhost:9100",
      region: "us-east-1",
      accessKeyId: "minioadmin",
      secretAccessKey: "minioadmin",
      bucket: "velo",
    },
    "GET",
    "test-key.txt",
    3600,
  );
  if (!url.includes("X-Amz-Signature=")) throw new Error("URL missing signature");
  console.log("SigV4 URL OK.");

  // ---- Migration file ----
  const sql = fs.readFileSync("migrations/001_init.sql", "utf8");
  console.log(`Migration file: ${sql.length} bytes, ${sql.split("CREATE TABLE").length - 1} tables.`);

  console.log("pg/s3 checks: PASS");
}

main().catch((e) => { console.error(e); process.exit(1); });
