import type { Database } from '../client';

export interface AuditRetryRow {
  readonly id: string;
  readonly payload_json: string;
  readonly attempts: number;
  readonly last_error: string | null;
  readonly created_at: number;
  readonly updated_at: number;
}

export async function enqueueAuditRetry(
  db: Database,
  id: string,
  payloadJson: string,
  nowMs: number,
): Promise<void> {
  await db.execute(
    `INSERT INTO permission_audit_retry (id, payload_json, attempts, last_error, created_at, updated_at)
     VALUES (?, ?, 0, NULL, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [id, payloadJson, nowMs, nowMs],
  );
}

export async function drainOldest(
  db: Database,
  limit: number,
): Promise<ReadonlyArray<AuditRetryRow>> {
  return db.select<AuditRetryRow>(
    `SELECT id, payload_json, attempts, last_error, created_at, updated_at
     FROM permission_audit_retry
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit],
  );
}

export async function updateAuditRetryAttempts(
  db: Database,
  id: string,
  attempts: number,
  lastError: string,
  nowMs: number,
): Promise<void> {
  await db.execute(
    `UPDATE permission_audit_retry
     SET attempts = ?, last_error = ?, updated_at = ?
     WHERE id = ?`,
    [attempts, lastError, nowMs, id],
  );
}

export async function deleteAuditRetry(db: Database, id: string): Promise<void> {
  await db.execute(`DELETE FROM permission_audit_retry WHERE id = ?`, [id]);
}
