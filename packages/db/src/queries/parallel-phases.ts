import type {
  IsoDateTime,
  ParallelMergeStrategy,
  ParallelPhaseGroup,
  ParallelPhaseGroupId,
  SessionId,
} from '@kay-am/types';
import type { Database } from '../client';

interface ParallelPhaseGroupRow {
  id: string;
  session_id: string;
  ordinal: number;
  merge_strategy: string;
  created_at: number;
  completed_at: number | null;
}

function toDomain(row: ParallelPhaseGroupRow): ParallelPhaseGroup {
  return {
    id: row.id as ParallelPhaseGroupId,
    sessionId: row.session_id as SessionId,
    ordinal: row.ordinal,
    mergeStrategy: row.merge_strategy as ParallelMergeStrategy,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    completedAt: row.completed_at
      ? (new Date(row.completed_at).toISOString() as IsoDateTime)
      : null,
  };
}

export async function insertGroup(db: Database, group: ParallelPhaseGroup): Promise<void> {
  await db.execute(
    `INSERT INTO parallel_phase_groups
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
): Promise<ReadonlyArray<ParallelPhaseGroup>> {
  const rows = await db.select<ParallelPhaseGroupRow>(
    'SELECT * FROM parallel_phase_groups WHERE session_id = ? ORDER BY ordinal ASC',
    [sessionId],
  );
  return rows.map(toDomain);
}

export async function getGroupById(
  db: Database,
  groupId: ParallelPhaseGroupId,
): Promise<ParallelPhaseGroup | null> {
  const rows = await db.select<ParallelPhaseGroupRow>(
    'SELECT * FROM parallel_phase_groups WHERE id = ? LIMIT 1',
    [groupId],
  );
  return rows.length > 0 ? toDomain(rows[0]!) : null;
}

export async function deleteGroup(db: Database, groupId: ParallelPhaseGroupId): Promise<void> {
  await db.execute('DELETE FROM parallel_phase_groups WHERE id = ?', [groupId]);
}

export async function updateGroupCompletedAt(
  db: Database,
  groupId: ParallelPhaseGroupId,
  completedAt: IsoDateTime,
): Promise<void> {
  await db.execute('UPDATE parallel_phase_groups SET completed_at = ? WHERE id = ?', [
    new Date(completedAt).getTime(),
    groupId,
  ]);
}
