import {
  invokeAuditRetryDelete,
  invokeAuditRetryDrain,
  invokeAuditRetryUpdate,
  invokePermissionAuditInsert,
  type AuditRetryEntry,
  type PermissionAuditInsertPayload,
} from '../../../features/permissions/permissions';
import { formatError } from '../../../shared/lib/errors';
import type { SetFn } from './types';

const AUDIT_RETRY_MAX_ATTEMPTS = 5;
const AUDIT_RETRY_DRAIN_BATCH = 50;
// Exponential backoff delays (ms): attempt 0→1s, 1→2s, 2→4s, 3→8s, 4→16s.
const AUDIT_RETRY_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000] as const;

function auditRetryBackoffMs(attempt: number): number {
  return AUDIT_RETRY_BACKOFF_MS[Math.min(attempt, AUDIT_RETRY_BACKOFF_MS.length - 1)] ?? 16000;
}

export async function drainAuditRetryQueue(set: SetFn): Promise<void> {
  let entries: ReadonlyArray<AuditRetryEntry>;
  try {
    entries = await invokeAuditRetryDrain(AUDIT_RETRY_DRAIN_BATCH);
  } catch {
    return;
  }

  const now = () => new Date().toISOString();

  for (const entry of entries) {
    // Respect backoff: skip entries updated too recently for their attempt count.
    const backoffMs = auditRetryBackoffMs(entry.attempts);
    const msSinceUpdate = Date.now() - entry.updatedAt;
    if (msSinceUpdate < backoffMs) continue;

    let payload: PermissionAuditInsertPayload;
    try {
      payload = JSON.parse(entry.payloadJson) as PermissionAuditInsertPayload;
    } catch {
      await invokeAuditRetryDelete(entry.id).catch(() => undefined);
      set((state) => ({
        systemAlerts: [
          ...state.systemAlerts,
          {
            id: crypto.randomUUID(),
            kind: 'audit-retry-corrupt' as const,
            message: `permission audit retry entry ${entry.id} had corrupt payload and was dropped`,
            createdAt: now(),
          },
        ],
      }));
      continue;
    }

    try {
      await invokePermissionAuditInsert(payload);
      await invokeAuditRetryDelete(entry.id);
    } catch (err) {
      const nextAttempts = entry.attempts + 1;
      const errMsg = formatError(err);

      if (nextAttempts >= AUDIT_RETRY_MAX_ATTEMPTS) {
        await invokeAuditRetryDelete(entry.id).catch(() => undefined);
        set((state) => ({
          systemAlerts: [
            ...state.systemAlerts,
            {
              id: crypto.randomUUID(),
              kind: 'audit-retry-exhausted' as const,
              message: `permission audit retry for entry ${entry.id} exhausted after ${AUDIT_RETRY_MAX_ATTEMPTS} attempts: ${errMsg}`,
              createdAt: now(),
            },
          ],
        }));
      } else {
        await invokeAuditRetryUpdate(entry.id, nextAttempts, errMsg).catch(() => undefined);
      }
    }
  }
}
