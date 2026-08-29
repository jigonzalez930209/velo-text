# Assets and S3

Allowed: PNG, JPEG, WebP, SVG. URLs are **not** stored on `AssetRef` — `storageKey` + `sha256` only. Signed URLs are ephemeral. `resolveAssetUrl` on the editor is a host map (blob URLs).

```ts
interface AssetRef {
  id: string; kind: "image";
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
  storageKey: string; sha256: string; byteLength: number;
  widthPx?: number; heightPx?: number; alt: string;
  variants?: Record<string, AssetVariant>;
}
```

Pipeline: size limit → magic sniff → MIME vs bytes → dimensions/bomb → sha256 → intent → PUT → confirm → insert node.

```ts
import { sniffImage, isAllowedMediaType, getDimensions, sanitizeSvg, getIconSvg, getAllIcons, iconCss } from "velo-text";
```

- Magic: PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF….WEBP`, SVG `<svg`/`<?xml`.
- `sanitizeSvg`: allowlist `svg,g,path,rect,…`; strip `script`, `foreignObject`, handlers, `javascript:`, remote refs.
- Store (`src/assets/store`): `createIntent` (dedupe), `confirm`, `addReference`/`removeReference`, `gc` when unreferenced.
- Icons: inline SVG `currentColor` → `--pde-icon-color`.

## S3 (host supplies credentials)

`createPresignedUrl` / `createS3Adapter` / `createFakeS3Adapter` in `src/adapters/s3-compatible` (SigV4: key, method, expiry, checksum). Not a runtime npm AWS client inside velo-text.

## Export pixels

PDF downscales **PNG** RGB to display `widthUm`/`heightUm`. JPEG not recompressed.
