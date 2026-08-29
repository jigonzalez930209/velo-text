# Security

- **Paste:** `DOMParser` allowlist; strip `script`, `javascript:`, handlers; 1 MB / 500k chars.
- **Variables:** own-property only; block `__proto__`/`prototype`/`constructor`; depth/length caps; never HTML.
- **Images:** magic bytes vs declared MIME; dimension bombs; hash dedupe.
- **SVG:** element allowlist; no `foreignObject`/handlers/remote.
- **XML/PDF:** escaped output.
- **ZIP:** sanitized entry names; no `../`.
- **Links:** `https:`, `mailto:`, `#` only.
- **Core:** no DOM/`fs`; `pnpm run lint` / `check:zero-deps` / `test:security`.

Threat matrix: repo `docs/threat-model.md`.
