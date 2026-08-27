# Assets

`src/assets/sniff/index.ts` — `sniffImage(bytes, declared?) → {mediaType, valid, reason}` (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`, SVG).

`src/assets/dimensions/index.ts` — `getPngDimensions`, `getJpegDimensions`, `getDimensions`.

`src/assets/hashing/index.ts` — `sha256Hex` (WebCrypto or Node `crypto`), `sha256HexSync`.

`src/assets/svg/index.ts` — `sanitizeSvg` (allowlist elements/attrs, strips `script`, `foreignObject`, `javascript:`).

`src/assets/icons/index.ts` — 28 icons, `getIconSvg(name,{size,color,className,title})` with `currentColor`, `getAllIcons`, `iconCss`.

`src/assets/store/index.ts` — `AssetStore` (`createIntent` dedupe per tenant, `confirm`, `addReference`, `gc`, `list` keyset).

See `src/adapters/s3-compatible` for presigned URLs.
