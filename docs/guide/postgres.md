# PostgreSQL

The package ships a **contract**: SQL + an in-memory repository. It does **not** depend on `pg`. Your app opens the client and maps rows onto `DocumentRepository`.

## Hybrid model
Relational columns for identity/permissions/revisions + `jsonb` for AST. `jsonb` gives operators/indexes; app validates invariants.

```sql
-- migrations/001_init.sql
CREATE TABLE documents (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  title text NOT NULL, schema_version integer NOT NULL,
  current_revision bigint DEFAULT 0,
  content jsonb NOT NULL, content_hash bytea NOT NULL,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
  deleted_at timestamptz,
  UNIQUE(tenant_id,id)
);
CREATE TABLE document_revisions (
  document_id uuid REFERENCES documents(id),
  revision bigint, content jsonb, content_hash bytea, created_at timestamptz,
  PRIMARY KEY(document_id, revision)
);
CREATE TABLE assets (id uuid PRIMARY KEY, tenant_id uuid, storage_key text, media_type text, sha256 bytea, byte_length bigint, status text, UNIQUE(tenant_id, sha256));
```

## Concurrency
Optimistic:
```sql
UPDATE documents SET content=$1, content_hash=$2, current_revision=current_revision+1 WHERE id=$3 AND tenant_id=$4 AND current_revision=$5 RETURNING current_revision;
```
If 0 rows → 409 Conflict with current revision. No last-write-wins.

## Idempotency
`idempotency_keys(key, tenant_id)` stores response for `create`/`update` with `Idempotency-Key` header.

## Indexes
- `btree` on `tenant_id`, `updated_at`
- Partial `WHERE deleted_at IS NULL`
- GIN on `content` only if justified (measured)
- Derived `document_variables` for frequent search

See `src/adapters/postgres-contract/index.ts` (in-memory ref) and `migrations/`.
