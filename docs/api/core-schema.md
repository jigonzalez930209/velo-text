# Core — Schema

`src/core/schema/validator.ts` — `validateDocument(doc, {strict,maxErrors}) → {valid, errors: {path,code,severity}[]}` with JSON Pointer, duplicate-id, table span, latex checks.

`src/core/schema/canonical.ts` — `canonicalStringify` (sorted keys), `canonicalBytes`, `contentHash`/`contentHashHex` (sha256).

`src/core/normalize/normalize.ts` — `normalizeDocument`, `isIdempotent` (merge adjacent texts).

`src/core/equation/index.ts` — `validateLatex`, `latexToHtml`, `latexToPlainText`.

See `schemas/portable-doc-v1.json` and `tests/fixtures/`.
