# Adapters

`src/adapters/browser/index.ts` — `createBlobSink`, `createMemorySink`, `createBrowserAssetResolver`.

`src/adapters/backend/index.ts` — `createFileSink(path)`, `createBufferSink`.

`src/adapters/postgres-contract/index.ts` — `DocumentRepository` (`create`/`get`/`update` with optimistic concurrency, `listRevisions`/`restore`, `listDocuments` keyset, `getIdempotency`), `createInMemoryRepository` ref, `migrations/001_init.sql`.

`src/adapters/s3-compatible/index.ts` — `S3Config`, `UploadIntent`, `createPresignedUrl` (SigV4 HMAC), `createFakeS3Adapter`, `createS3Adapter`.

See `examples/postgres.mjs`, `examples/s3.mjs`.
