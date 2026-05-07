import type { SessionId } from '@kay-am/types';
import type { Database } from '../client';

interface SessionWorktreeRow {
  id: string;
  session_id: string;
  worktree_path: string;
  branch: string;
  parallel_index: number;
  created_at: number;
}

export interface SessionWorktree {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly branch: string;
  readonly parallelIndex: number;
  readonly createdAt: number;
}

function toDomain(row: SessionWorktreeRow): SessionWorktree {
  return {
    id: row.id,
    sessionId: row.session_id as SessionId,
    worktreePath: row.worktree_path,
    branch: row.branch,
    parallelIndex: row.parallel_index,
    createdAt: row.created_at,
  };
}

export async function insertSessionWorktree(
  db: Database,
  worktree: SessionWorktree,
): Promise<void> {
  await db.execute(
    `INSERT INTO session_worktrees
      (id, session_id, worktree_path, branch, parallel_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      worktree.id,
      worktree.sessionId,
      worktree.worktreePath,
      worktree.branch,
      worktree.parallelIndex,
      worktree.createdAt,
    ],
  );
}

export async function listWorktreesForSession(
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<SessionWorktree>> {
  const rows = await db.select<SessionWorktreeRow>(
    'SELECT * FROM session_worktrees WHERE session_id = ? ORDER BY parallel_index ASC',
    [sessionId],
  );
  return rows.map(toDomain);
}

export async function deleteWorktreesForSession(db: Database, sessionId: SessionId): Promise<void> {
  await db.execute('DELETE FROM session_worktrees WHERE session_id = ?', [sessionId]);
}
