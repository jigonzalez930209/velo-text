# Threat Model — Phase 12.1.2

## Assets
- PortableDocument JSON (user content)
- Assets (images) in S3-compatible storage
- Revision history in PostgreSQL

## Attackers
- Unauthenticated content injection via paste, variables, SVG, DOCX/ZIP
- Tenant isolation bypass
- Prototype pollution via variable paths

## Mitigations

| Threat | Mitigation | Location |
|---|---|---|
| XSS via pasted HTML | Allowlist sanitization, strip `javascript:` URLs, event handlers | `src/editor-web/clipboard/index.ts:12` |
| XXE via SVG/XML | Internal XML writer with escaping, no entity expansion, forbid `<!ENTITY` | `src/export/xml/writer.ts:1`, `src/assets/svg/index.ts:1` |
| Zip bombs | Size limits 1 MB paste, dimensions anti-bomb, stream limits, no auto-extract | `src/assets/sniff/index.ts:1`, `src/editor-web/clipboard/index.ts:15` |
| SSRF via asset URLs | Only allow S3 presigned URLs with limited lifetime, validate storageKey prefix `tenants/{tenant}` | `src/adapters/s3-compatible/index.ts:1` |
| Prototype pollution | Block `__proto__`, `prototype`, `constructor` in `safeResolve`, own-property checks | `src/template/resolver/resolver.ts:12` |
| Path traversal in ZIP | Sanitize entry names, reject `../`, control chars | `src/editor-web/clipboard/index.ts:85` |
| Tenant isolation | Check `tenant_id` on every PG query, idempotency keys scoped | `migrations/001_init.sql:1`, `src/adapters/postgres-contract/index.ts:1` |
| ReDoS in LaTeX | Length limit 2000, no backtracking regex | `src/core/equation/index.ts:12` |

## Verification
- `pnpm run test` includes corpus of malicious fixtures (see `tests/security/`)
- Fuzz harness `scripts/fuzz.js` with reproducible seeds
- `pnpm run lint` ensures zero `window`/`document` in core
