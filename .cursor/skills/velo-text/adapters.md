# Adapters (Node, PG, HTTP, browser)

Adapters are **ports**. The package does not depend on Express, `pg`, or AWS.

## Backend (`velo-text/backend`)

```ts
import { createBufferSink, createFileSink, handlePdfExportJson, expressPdfHandler, vercelPdfHandler, vitePdfPlugin } from "velo-text/backend";
import { exportDocument } from "velo-text/export";

const { sink, getBuffer } = createBufferSink();
await exportDocument({ document, data, format: "pdf", sink, options: { strict: false } });
const pdf = getBuffer(); // Uint8Array

createFileSink("/tmp/out.pdf");
```

JSON body fill: `handlePdfExportJson` / `sendPdfHttpResult`. Samples: `examples/backend.mjs`, `examples/http-api.mjs`, `examples/backend/`.

## Slot map (`velo-text/api-report`)

Do not load this (or `/export`, `/backend`) in the browser bundle if size matters. No Puppeteer/pdf-lib.

| kind | tag |
| --- | --- |
| variable | `path` |
| image / inline-image | `assetId` |
| table | `repeat.path` or node id |
| table-repeat | `repeat.path` |
| equation / equation-block | node id (`latex` on slot) |
| columns | node id |

`pointer` is a JSON-pointer-like AST path.

```ts
import { reportSlots, dataFromSlotValues, assetsFromSlotValues } from "velo-text/api-report";

const slots = reportSlots(document);
const data = dataFromSlotValues({ "customer.name": "Ada", items: [{ name: "Widget" }] });
const assets = assetsFromSlotValues({ logo: { mediaType: "image/png", data: pngBytes } });
```

## PostgreSQL contract

No `pg` dependency. SQL + `createInMemoryRepository(): DocumentRepository`. App maps rows.

Hybrid: relational identity/revisions + `jsonb` AST. Optimistic concurrency: `UPDATE … WHERE current_revision=$n`; 0 rows → 409. Idempotency keys for create/update. See `src/adapters/postgres-contract` and `migrations/001_init.sql`. `examples/postgres.mjs`.

## Browser sinks

`createBlobSink`, `createMemorySink`, `createBrowserAssetResolver` — `src/adapters/browser`.

## S3

See [assets.md](assets.md). `examples/s3.mjs`.
