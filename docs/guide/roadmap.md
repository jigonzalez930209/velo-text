# Roadmap

This is the **product** plan. Design notes live in the repo (`roadmap_editor_documental_portable.md`, `roadmap_usabilidad_y_adaptadores.md`). Status is honest against the code: `[x]` shipped · `[~]` partial · `[ ]` not started.

We are on **`1.0.0-beta`**. A frozen **1.0.0** needs the items in **Next**, not a rewrite of the core.

## Now (shipped in the beta)

**Core.** Versioned JSON AST, operations, normalize, canonical hash, history (document snapshot + ops), schema + validator.

**Editor.** `contenteditable` host, IME, paste allowlist, tables (cells, align, col/row resize, merge/split), columns, images (drop, resize, align), LaTeX subset, four themes.

**Usability (track A — all `[x]`).** Command palette and slash menu, selection bubble, variable/link popovers, find/replace, template preview, outline, image-as-product, page preview, autosave/restore hooks, keyboard/`?` sheet and narrow viewport.

**Templates.** `{{path | format ?? "fallback"}}`, safe resolver, currency/date, repeat rows.

**Export.** `exportDocument` for **PDF, ODT, and DOCX**. PDF is the strongest path (layout, contiguous tables, PNG downscale). Office packages are product-complete at the API surface; visual parity vs PDF is still weaker.

**Hosts.** Vanilla / React / Vue / Svelte / Angular / Astro samples. No framework in the core package.

**Ports.** In-memory document repo + SQL migration; S3 SigV4 helpers. No `pg` driver and no live bucket in CI.

## Next (toward 1.0.0)

Ordered so each slice is testable without expanding the AST. **No new runtime npm deps.** Optional entries stay split so the editor bundle never pulls export or LibreOffice.

1. **`velo-text/api-report` (slots)** — `[x]` map of variable / table / image / equation tags for the backend; `dataFromSlotValues` / `assetsFromSlotValues`. Front installs only `editor-web` / `vanilla`. Nothing gzip > 2 MB.
2. **Office CI** — open/save a golden ODT and DOCX with **system** LibreOffice on the runner (apt), not an npm WASM. Today we only have in-repo validators.
3. **PDF / Office parity** — tables, image align/size, columns, and equations in ODT/DOCX closer to the PDF boxes. SVG/WebP PNG fallback for old Word — our encoder, no extra suite.
4. **PDF fonts** — Standard-14 Helvetica/Symbol only. Optional **embedded TTF** behind a host-supplied font **bytes** port (license stays with the host; we do not ship font files).
5. **Real PG / S3 in CI** — optional job with `pg` and a fake S3 **in the workflow**, not in `dependencies`.
6. **Color / fontSize in PDF** — `[x]` AST marks (`color`, `fontSizePt`, bold/italic) map to `/rg` and Standard-14 faces in the same `exportPdf` path.
7. **Perceptual goldens** — `[x]` HTML snapshots plus CI raster diffs (`pdftoppm` / poppler-utils, not an npm dep): `pnpm run test:pdf-pages`.

## Later (explicitly out of 1.0)

| Item | Why it waits |
| --- | --- |
| CRDT / comments / track changes | Second source of truth; breaks the single-AST rule |
| Import arbitrary DOCX/ODT | Inverse of export; unbounded surface |
| OfficeMath / OMML | LaTeX subset is enough for v1 |
| Native OS print / Word headers-footers | Page preview already uses `document.page` + layout |
| Extra themes, plugin marketplace, AI | Tokens + four presets are the contract |
| Puppeteer / LO-in-the-browser / fat PDF kits | Exceeds the ~2 MB gzip budget; export is our writers |

## How we take a slice

1. One user-visible path in the [Playground](/playground/).
2. At least Vanilla (or the adapter that owns the feature).
3. Export must not regress (`exportDocument` + smoke).
4. `dependencies` stays `{}`.
5. A short note on the matching guide page.

Source files stay **≤ 250 lines**. New behavior goes through ports (`Clock`, `IdGenerator`, `BinarySink`, `AssetResolver`) — not `window` in `src/core`.
