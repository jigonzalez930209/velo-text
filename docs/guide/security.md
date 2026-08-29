# Security

Full matrix (XSS, XXE, zip bombs, SSRF, prototype pollution, traversal): [Threat model](/threat-model).

- **Paste:** `DOMParser` allowlist, strip `script` / `javascript:` / handlers, 1 MB cap
- **Variables:** own-property only, blocked `__proto__`, max depth/length, never HTML
- **Images:** magic signature, MIME vs bytes, dimension bombs, hash dedupe
- **XML/PDF:** escaped; unknown props ignored unless a policy says otherwise
- **ZIP:** sanitized entry names, no `../`

Fuzz: `scripts/fuzz.js` (LCG, reproducible seeds).

CI: `pnpm run check:zero-deps`, `pnpm run lint` (no `window` in `src/core/**/*.ts`), `pnpm run test:security`.
