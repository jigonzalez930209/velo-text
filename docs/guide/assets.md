# Assets & S3

## Upload pipeline
```
select/drag-drop → size limit → header sniff → format detection → dimensions & bomb protection → sha256 → createIntent → PUT presigned URL → confirm → AssetRef → insert node
```

## Sniffing
Magic signatures for PNG (`89 50 4E 47`), JPEG (`FF D8 FF`), WebP (`RIFF....WEBP`), SVG (`<svg`/`<?xml`). Declared MIME vs real must match or `mime-mismatch`.

## Dimensions & hashing
`getDimensions` without full decode when possible; JPEG orientation handled. SHA-256 via WebCrypto or Node `crypto`, dedupe per tenant `UNIQUE(tenant_id, sha256)`.

## SVG sanitization
Internal XML allowlist (`svg,g,path,rect...`), strips `script`, `foreignObject`, event handlers, `javascript:` URLs, remote refs.

## S3 adapter
Presigned URLs (SigV4) restrict key, method, expiry, checksum — `createPresignedUrl`/`createS3Adapter` in `src/adapters/s3-compatible`. Fake adapter for tests, real for prod.

## Store
`src/assets/store/index.ts` — `AssetStore` with `createIntent` (dedupe), `confirm`, `addReference`/`removeReference` transactional, `gc` deferred deletion when unreferenced, keyset pagination.

## Export size
PDF embedding downscales **PNG** RGB to the largest on-page size (`widthUm`/`heightUm` at 96 dpi). JPEG bytes are not recompressed. See [Export](/guide/export).

See `src/assets/sniff|dimensions|hashing|svg|icons|store` and `src/adapters/s3-compatible`.
