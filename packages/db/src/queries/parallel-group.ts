import type {
  IsoDateTime,
  ParallelGroup,
  ParallelGroupId,
  ParallelMergeStrategy,
  SessionId,
} from '@goodboy/types';
import type { Database } from '../client';

interface ParallelGroupRow {
  id: string;
  session_id: string;
  ordinal: number;
  merge_strategy: string;
  created_at: number;
  completed_at: number | null;
}

function toDomain(row: ParallelGroupRow): ParallelGroup {
  return {
    id: row.id as ParallelGroupId,
    sessionId: row.session_id as SessionId,
    ordinal: row.ordinal,
    mergeStrategy: row.merge_strategy as ParallelMergeStrategy,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    completedAt: row.completed_at
      ? (new Date(row.completed_at).toISOString() as IsoDateTime)
      : null,
  };
}

export async function insertGroup(db: Database, group: ParallelGroup): Promise<void> {
  await db.execute(
    `INSERT INTO parallel_groups
      (id, session_id, ordinal, merge_strategy, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      group.id,
      group.sessionId,
      group.ordinal,
      group.mergeStrategy,
      new Date(group.createdAt).getTime(),
      group.completedAt ? new Date(group.completedAt).getTime() : null,
    ],
  );
}

export async function listGroupsForSession(
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<ParallelGroup>> {
  const rows = await db.select<ParallelGroupRow>(
    'SELECT * FROM parallel_groups WHERE session_id = ? ORDER BY ordinal ASC',
    [sessionId],
  );
  return rows.map(toDomain);
}

export async function getGroupById(
  db: Database,
  groupId: ParallelGroupId,
): Promise<ParallelGroup | null> {
  const rows = await db.select<ParallelGroupRow>(
    'SELECT * FROM parallel_groups WHERE id = ? LIMIT 1',
    [groupId],
  );
  return rows.length > 0 ? toDomain(rows[0]!) : null;
}

export async function deleteGroup(db: Database, groupId: ParallelGroupId): Promise<void> {
  await db.execute('DELETE FROM parallel_groups WHERE id = ?', [groupId]);
}

export async function updateGroupCompletedAt(
  db: Database,
  groupId: ParallelGroupId,
  completedAt: IsoDateTime,
): Promise<void> {
  await db.execute('UPDATE parallel_groups SET completed_at = ? WHERE id = ?', [
    new Date(completedAt).getTime(),
    groupId,
  ]);
}
