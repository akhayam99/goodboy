import type { ContextSlot, TaskId } from '@kay-am/types';
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
