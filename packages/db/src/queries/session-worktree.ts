import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

type SessionWorktreeRow = {
  id: string;
  session_id: string;
  worktree_path: string;
  branch: string;
  parallel_index: number;
  mount_workspace_id: string | null;
  mount_name: string | null;
  created_at: number;
};

export type SessionWorktree = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly branch: string;
  readonly parallelIndex: number;
  readonly mountWorkspaceId?: WorkspaceId;
  readonly mountName?: string;
  readonly createdAt: number;
};

function toDomain(row: SessionWorktreeRow): SessionWorktree {
  return {
    id: row.id,
    sessionId: row.session_id as SessionId,
    worktreePath: row.worktree_path,
    branch: row.branch,
    parallelIndex: row.parallel_index,
    ...(row.mount_workspace_id != null
      ? { mountWorkspaceId: row.mount_workspace_id as WorkspaceId }
      : {}),
    ...(row.mount_name != null ? { mountName: row.mount_name } : {}),
    createdAt: row.created_at,
  };
}

export const insertSessionWorktree = async (
  db: Database,
  worktree: SessionWorktree,
): Promise<void> => {
  await db.execute(
    `INSERT INTO session_worktrees
      (id, session_id, worktree_path, branch, parallel_index, mount_workspace_id, mount_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      worktree.id,
      worktree.sessionId,
      worktree.worktreePath,
      worktree.branch,
      worktree.parallelIndex,
      worktree.mountWorkspaceId ?? null,
      worktree.mountName ?? null,
      worktree.createdAt,
    ],
  );
};

export const listWorktreesForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<SessionWorktree>> => {
  const rows = await db.select<SessionWorktreeRow>(
    'SELECT * FROM session_worktrees WHERE session_id = ? ORDER BY parallel_index ASC',
    [sessionId],
  );
  return rows.map(toDomain);
};

export const listWorktreesForSessions = async (
  db: Database,
  sessionIds: ReadonlyArray<SessionId>,
): Promise<Map<SessionId, ReadonlyArray<SessionWorktree>>> => {
  const out = new Map<SessionId, SessionWorktree[]>();
  if (sessionIds.length === 0) {
    return out;
  }
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
};

export const deleteWorktreesForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<void> => {
  await db.execute('DELETE FROM session_worktrees WHERE session_id = ?', [sessionId]);
};

export const updateSessionWorktreeBranch = async (
  db: Database,
  sessionId: SessionId,
  parallelIndex: number,
  branch: string,
): Promise<void> => {
  await db.execute(
    'UPDATE session_worktrees SET branch = ? WHERE session_id = ? AND parallel_index = ?',
    [branch, sessionId, parallelIndex],
  );
};

type UpdateSessionWorktreePathParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly parallelIndex: number;
  readonly worktreePath: string;
};

export const updateSessionWorktreePath = async ({
  db,
  sessionId,
  parallelIndex,
  worktreePath,
}: UpdateSessionWorktreePathParams): Promise<void> => {
  await db.execute(
    'UPDATE session_worktrees SET worktree_path = ? WHERE session_id = ? AND parallel_index = ?',
    [worktreePath, sessionId, parallelIndex],
  );
};

export const listAllSessionWorktrees = async (
  db: Database,
): Promise<ReadonlyArray<SessionWorktree>> => {
  const rows = await db.select<SessionWorktreeRow>('SELECT * FROM session_worktrees', []);
  return rows.map(toDomain);
};
