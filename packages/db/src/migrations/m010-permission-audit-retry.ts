export const m010PermissionAuditRetry = /* sql */ `
CREATE TABLE IF NOT EXISTS permission_audit_retry (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_permission_audit_retry_created ON permission_audit_retry(created_at);
`;
