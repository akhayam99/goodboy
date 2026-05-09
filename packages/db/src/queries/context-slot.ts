import type {
  ContextSlot,
  ContextSlotAuthor,
  ContextSlotHistoryEntry,
  TaskId,
} from '@kay-am/types';
import type { IsoDateTime } from '@kay-am/types';
import type { Database } from '../client';

interface ContextSlotRow {
  task_id: string;
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
  taskId: TaskId,
  slot: ContextSlot,
): Promise<void> {
  await db.execute(
    `INSERT INTO context_slots (task_id, key, value, enabled)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(task_id, key) DO UPDATE SET
       value = excluded.value,
       enabled = excluded.enabled`,
    [taskId, slot.key, slot.value, slot.enabled ? 1 : 0],
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
  taskId: TaskId,
  id: string,
  key: string,
  value: string,
  author: ContextSlotAuthor,
): Promise<void> {
  await db.execute(
    `INSERT INTO context_slot_history (id, task_id, key, value, author, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, taskId, key, value, author, Date.now()],
  );
  await db.execute(
    `DELETE FROM context_slot_history
     WHERE task_id = ? AND key = ? AND id NOT IN (
       SELECT id FROM context_slot_history
       WHERE task_id = ? AND key = ?
       ORDER BY created_at DESC
       LIMIT ${HISTORY_CAP}
     )`,
    [taskId, key, taskId, key],
  );
}

export async function listContextSlotHistory(
  db: Database,
  taskId: TaskId,
  key: string,
): Promise<ReadonlyArray<ContextSlotHistoryEntry>> {
  const rows = await db.select<ContextSlotHistoryRow>(
    `SELECT id, key, value, author, created_at
     FROM context_slot_history
     WHERE task_id = ? AND key = ?
     ORDER BY created_at DESC`,
    [taskId, key],
  );
  return rows.map(toHistoryDomain);
}

export async function listContextSlotsForTask(
  db: Database,
  taskId: TaskId,
): Promise<ReadonlyArray<ContextSlot>> {
  const rows = await db.select<ContextSlotRow>(
    'SELECT * FROM context_slots WHERE task_id = ? ORDER BY key',
    [taskId],
  );
  return rows.map(toDomain);
}
