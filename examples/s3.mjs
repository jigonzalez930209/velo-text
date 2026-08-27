#!/usr/bin/env node
/**
 * Example: S3-compatible storage with presigned URLs — Phase 11.2.3
 * Demonstrates upload intent, PUT to presigned URL, confirmation and download.
 */
import { createFakeS3Adapter, createPresignedUrl } from "../dist/adapters/s3-compatible/index.js";
import { createInMemoryAssetStore } from "../dist/assets/store/index.js";

const s3 = createFakeS3Adapter();
const store = createInMemoryAssetStore();
const tenantId = "tenant_123";

// 1. Client requests upload intent
const intent = {
  tenantId,
  sha256: "a".repeat(64),
  byteLength: 1234,
  mediaType: "image/png",
  fileName: "logo.png",
};
const { asset, isDuplicate } = await store.createIntent(intent);
console.log("intent", asset.id, "duplicate?", isDuplicate);

// 2. Get presigned PUT URL (S3 adapter)
const fakeIntent = await s3.createUploadIntent({ sha256: intent.sha256, byteLength: intent.byteLength, mediaType: intent.mediaType, fileName: intent.fileName });
console.log("uploadUrl", fakeIntent.uploadUrl, "headers", fakeIntent.requiredHeaders);

// 3. Simulate PUT (in fake, just confirm)
await s3.confirmUpload(fakeIntent.assetId);
await store.confirm(asset.id, tenantId);
console.log("confirmed", asset.id);

// 4. Add reference from document
await store.addReference("doc_123", asset.id, tenantId);
console.log("referenced");

// 5. Presigned download URL with SigV4 (real adapter)
const config = {
  endpoint: "https://s3.example.com",
  region: "us-east-1",
  accessKeyId: "AKIAEXAMPLE",
  secretAccessKey: "secret",
  bucket: "my-bucket",
};
const url = await createPresignedUrl(config, "GET", `tenants/${tenantId}/assets/${asset.id}`, 3600);
console.log("presigned GET", url.slice(0, 80) + "...");

// 6. Dedupe: second intent with same hash returns same asset
const { asset: asset2, isDuplicate: dup2 } = await store.createIntent(intent);
console.log("dedupe", asset2.id === asset.id, dup2);

// 7. GC orphaned
await store.removeReference("doc_123", asset.id, tenantId);
const deleted = await store.gc(0);
console.log("gc deleted", deleted);
