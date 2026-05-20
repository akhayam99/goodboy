import type {
  ContextSlot,
  ContextSlotAuthor,
  ContextSlotHistoryEntry,
  SessionId,
} from '@goodboy/types';
import type { IsoDateTime } from '@goodboy/types';
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

const HISTORY_CAP = 20;

interface ContextSlotHistoryRow {
  id: string;
  key: string;
  value: string;
  author: string;
  created_at: number;
}

function toHistoryDomain(row: ContextSlotHistoryRow): ContextSlotHistoryEntry {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    author: row.author as ContextSlotAuthor,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  };
}

export async function insertContextSlotHistory(
  db: Database,
  sessionId: SessionId,
  id: string,
  key: string,
  value: string,
  author: ContextSlotAuthor,
): Promise<void> {
  await db.execute(
    `INSERT INTO context_slot_history (id, session_id, key, value, author, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, sessionId, key, value, author, Date.now()],
  );
  await db.execute(
    `DELETE FROM context_slot_history
     WHERE session_id = ? AND key = ? AND id NOT IN (
       SELECT id FROM context_slot_history
       WHERE session_id = ? AND key = ?
       ORDER BY created_at DESC
       LIMIT ${HISTORY_CAP}
     )`,
    [sessionId, key, sessionId, key],
  );
}

export async function listContextSlotHistory(
  db: Database,
  sessionId: SessionId,
  key: string,
): Promise<ReadonlyArray<ContextSlotHistoryEntry>> {
  const rows = await db.select<ContextSlotHistoryRow>(
    `SELECT id, key, value, author, created_at
     FROM context_slot_history
     WHERE session_id = ? AND key = ?
     ORDER BY created_at DESC`,
    [sessionId, key],
  );
  return rows.map(toHistoryDomain);
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
