-- Migration 001: initial schema — Phase 10.1
-- Hybrid model: jsonb for AST + relational columns for identity/permissions/revisions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  title text NOT NULL,
  schema_version integer NOT NULL,
  current_revision bigint NOT NULL DEFAULT 0,
  content jsonb NOT NULL,
  content_hash bytea NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deleted_at timestamptz,
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS document_revisions (
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision bigint NOT NULL,
  content jsonb NOT NULL,
  content_hash bytea NOT NULL,
  author_id uuid,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (document_id, revision)
);

CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  storage_key text NOT NULL,
  media_type text NOT NULL,
  sha256 bytea NOT NULL,
  byte_length bigint NOT NULL,
  width_px integer,
  height_px integer,
  status text NOT NULL CHECK (status IN ('pending','confirmed','orphaned','deleted')),
  created_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  UNIQUE (tenant_id, sha256)
);

CREATE TABLE IF NOT EXISTS document_assets (
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  PRIMARY KEY (document_id, asset_id)
);

-- Idempotency keys for create/update (Phase 10.1.1)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  response jsonb
);

-- Indexes — Phase 10.3 (measured, not indiscriminate)
CREATE INDEX IF NOT EXISTS idx_documents_tenant_updated ON documents(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_not_deleted ON documents(tenant_id) WHERE deleted_at IS NULL;
-- GIN on content only if justified — created as partial example, disabled by default
-- CREATE INDEX IF NOT EXISTS idx_documents_content_gin ON documents USING GIN (content) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assets_tenant_sha ON assets(tenant_id, sha256);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status) WHERE status = 'orphaned';

-- Document variables derived table for frequent search (optional, not indexed by default)
CREATE TABLE IF NOT EXISTS document_variables (
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  variable_path text NOT NULL,
  PRIMARY KEY (document_id, variable_path)
);
CREATE INDEX IF NOT EXISTS idx_doc_vars_path ON document_variables(variable_path);

-- Example EXPLAIN plan versioning for critical queries (Phase 10.1.3)
-- Store explain plans in a separate audit table if needed
