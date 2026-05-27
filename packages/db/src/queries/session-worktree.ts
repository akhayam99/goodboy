import type { SessionId } from '@goodboy/types';
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

// Batched lookup for workspace switch: replaces `Promise.all(ids.map(listWorktreesForSession))`,
// which used to serialize N round trips through the single `Mutex<Connection>` on the Rust
// side. One IN-clause query + group-by-session keeps the result shape per-session.
export async function listWorktreesForSessions(
  db: Database,
  sessionIds: ReadonlyArray<SessionId>,
): Promise<Map<SessionId, ReadonlyArray<SessionWorktree>>> {
  const out = new Map<SessionId, SessionWorktree[]>();
  if (sessionIds.length === 0) return out;
  const placeholders = sessionIds.map(() => '?').join(', ');
  const rows = await db.select<SessionWorktreeRow>(
    `SELECT * FROM session_worktrees WHERE session_id IN (${placeholders}) ORDER BY session_id, parallel_index ASC`,
    sessionIds,
  );
  for (const row of rows) {
    const wt = toDomain(row);
    const bucket = out.get(wt.sessionId) ?? [];
    bucket.push(wt);
    out.set(wt.sessionId, bucket);
  }
  return out;
}

export async function deleteWorktreesForSession(db: Database, sessionId: SessionId): Promise<void> {
  await db.execute('DELETE FROM session_worktrees WHERE session_id = ?', [sessionId]);
}

export async function updateSessionWorktreeBranch(
  db: Database,
  sessionId: SessionId,
  parallelIndex: number,
  branch: string,
): Promise<void> {
  await db.execute(
    'UPDATE session_worktrees SET branch = ? WHERE session_id = ? AND parallel_index = ?',
    [branch, sessionId, parallelIndex],
  );
}

export async function listAllSessionWorktrees(
  db: Database,
): Promise<ReadonlyArray<SessionWorktree>> {
  const rows = await db.select<SessionWorktreeRow>('SELECT * FROM session_worktrees', []);
  return rows.map(toDomain);
}
