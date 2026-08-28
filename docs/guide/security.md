# Security

See `docs/threat-model.md` for full matrix (XSS, XXE, Zip bombs, SSRF, prototype pollution, traversal).

- Paste: allowlist `DOMParser`, strip `script`/`javascript:`/event handlers, 1 MB limit
- Variables: own-property only, blocked `__proto__`, max depth/length, never HTML
- Images: magic-signature, MIME vs real, dimensions anti-bomb, hash dedupe
- XML/PDF: escaped, unknown props ignored unless policy
- ZIP: sanitized entry names, no `../`

Fuzz harness `scripts/fuzz.js` (LCG, reproducible seeds).

Audit: `pnpm run check:zero-deps`, `pnpm run lint` (no `window` in `src/core/**/*.ts`), `pnpm run test:security`.
