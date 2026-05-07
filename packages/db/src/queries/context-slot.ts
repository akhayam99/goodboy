import type { ContextSlot, SessionId } from '@kay-am/types';
import type { Database } from '../client';

interface ContextSlotRow {
  session_id: string;
  key: string;
  value: string;
  enabled: number;
}

function toDomain(row: ContextSlotRow): ContextSlot {
  return {
    key: row.key,
    value: row.value,
    enabled: row.enabled === 1,
  };
}

export async function upsertContextSlot(
  db: Database,
  sessionId: SessionId,
  slot: ContextSlot,
): Promise<void> {
  await db.execute(
    `INSERT INTO context_slots (session_id, key, value, enabled)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id, key) DO UPDATE SET
       value = excluded.value,
       enabled = excluded.enabled`,
    [sessionId, slot.key, slot.value, slot.enabled ? 1 : 0],
  );
}

export async function listContextSlotsForSession(
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<ContextSlot>> {
  const rows = await db.select<ContextSlotRow>(
    'SELECT * FROM context_slots WHERE session_id = ? ORDER BY key',
    [sessionId],
  );
  return rows.map(toDomain);
}
