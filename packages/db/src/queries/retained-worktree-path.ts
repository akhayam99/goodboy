import type {
  IsoDateTime,
  MountId,
  RetainedWorktreePath,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { Database, PlainStatement } from '../client';
import { UniqueViolationError } from '../shared/errors';

type Row = {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly projectId: RetainedWorktreePath['projectId'];
  readonly sourceSessionId: SessionId;
  readonly sourceMountId: MountId;
  readonly repoRoot: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly reason: RetainedWorktreePath['reason'];
  readonly lastCheckedAt: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
};

type ListRetainedWorktreePathsParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

type TransferMountPathParams = {
  readonly db: Database;
  readonly retained: RetainedWorktreePath;
  readonly expectedRevision: number;
};

const toDomain = (row: Row): RetainedWorktreePath => ({
  ...row,
  lastCheckedAt:
    row.lastCheckedAt === null ? null : (new Date(row.lastCheckedAt).toISOString() as IsoDateTime),
  createdAt: new Date(row.createdAt).toISOString() as IsoDateTime,
  updatedAt: new Date(row.updatedAt).toISOString() as IsoDateTime,
});

export const listRetainedWorktreePaths = async ({
  db,
  workspaceId,
}: ListRetainedWorktreePathsParams): Promise<ReadonlyArray<RetainedWorktreePath>> => {
  const rows = await db.select<Row>(
    `SELECT id, workspace_id AS workspaceId, project_id AS projectId,
            source_session_id AS sourceSessionId, source_mount_id AS sourceMountId,
            repo_root AS repoRoot, worktree_path AS worktreePath, branch, reason,
            last_checked_at AS lastCheckedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM retained_worktree_paths WHERE workspace_id = ? ORDER BY created_at, id`,
    [workspaceId],
  );
  return rows.map(toDomain);
};

type RetainedPathInsertParams = {
  readonly retained: RetainedWorktreePath;
};

export const retainedPathInsertStatement = ({
  retained,
}: RetainedPathInsertParams): PlainStatement => ({
  sql: `INSERT INTO retained_worktree_paths
    (id, workspace_id, project_id, source_session_id, source_mount_id, repo_root,
     worktree_path, branch, reason, last_checked_at, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  params: [
    retained.id,
    retained.workspaceId,
    retained.projectId,
    retained.sourceSessionId,
    retained.sourceMountId,
    retained.repoRoot,
    retained.worktreePath,
    retained.branch,
    retained.reason,
    retained.lastCheckedAt === null ? null : Date.parse(retained.lastCheckedAt),
    Date.parse(retained.createdAt),
    Date.parse(retained.updatedAt),
  ],
});

const STALE_MOUNT = 'STALE_MOUNT';
const PATH_OWNED = 'PATH_OWNED';

export const transferMountPathToRetained = async ({
  db,
  retained,
  expectedRevision,
}: TransferMountPathParams): Promise<boolean> => {
  const mountKey = [
    retained.sourceSessionId,
    retained.sourceMountId,
    expectedRevision,
    retained.worktreePath,
  ];
  const outcome = await db.transaction({
    statements: [
      {
        sql: `SELECT id FROM session_worktrees
         WHERE session_id = ? AND id = ? AND revision = ? AND worktree_path = ? LIMIT 1`,
        params: mountKey,
        abortWhen: 'noRows',
        abortCode: STALE_MOUNT,
      },
      {
        sql: `SELECT id FROM session_worktrees WHERE worktree_path = ? AND id != ?
         UNION ALL
         SELECT id FROM retained_worktree_paths WHERE worktree_path = ?
         LIMIT 1`,
        params: [retained.worktreePath, retained.sourceMountId, retained.worktreePath],
        abortWhen: 'rows',
        abortCode: PATH_OWNED,
      },
      retainedPathInsertStatement({ retained }),
      {
        sql: `UPDATE session_worktrees
         SET worktree_path = NULL, last_worktree_path = ?, is_attached = 0,
             disk_state = 'removed', revision = revision + 1, updated_at = ?
         WHERE session_id = ? AND id = ? AND revision = ? AND worktree_path = ?`,
        params: [retained.worktreePath, Date.parse(retained.updatedAt), ...mountKey],
        abortWhen: 'noChanges',
        abortCode: STALE_MOUNT,
      },
      {
        sql: 'UPDATE sessions SET active_mount_id = NULL WHERE id = ? AND active_mount_id = ?',
        params: [retained.sourceSessionId, retained.sourceMountId],
      },
    ],
  });
  if (outcome.status === 'aborted' && outcome.abortCode === PATH_OWNED) {
    throw new UniqueViolationError('retained worktree path', 'worktreePath');
  }
  return outcome.status === 'committed';
};

type RetainedKeyParams = {
  readonly db: Database;
  readonly id: string;
};

type MarkRetainedCheckedParams = RetainedKeyParams & {
  readonly lastCheckedAt: IsoDateTime;
};

const SELECT_COLUMNS = `id, workspace_id AS workspaceId, project_id AS projectId,
            source_session_id AS sourceSessionId, source_mount_id AS sourceMountId,
            repo_root AS repoRoot, worktree_path AS worktreePath, branch, reason,
            last_checked_at AS lastCheckedAt, created_at AS createdAt, updated_at AS updatedAt`;

export const listAllRetainedWorktreePaths = async ({
  db,
}: {
  readonly db: Database;
}): Promise<ReadonlyArray<RetainedWorktreePath>> => {
  const rows = await db.select<Row>(
    `SELECT ${SELECT_COLUMNS} FROM retained_worktree_paths ORDER BY created_at, id`,
    [],
  );
  return rows.map(toDomain);
};

export const deleteRetainedWorktreePath = async ({ db, id }: RetainedKeyParams): Promise<void> => {
  await db.execute('DELETE FROM retained_worktree_paths WHERE id = ?', [id]);
};

export const markRetainedWorktreePathChecked = async ({
  db,
  id,
  lastCheckedAt,
}: MarkRetainedCheckedParams): Promise<void> => {
  await db.execute(
    'UPDATE retained_worktree_paths SET last_checked_at = ?, updated_at = ? WHERE id = ?',
    [Date.parse(lastCheckedAt), Date.parse(lastCheckedAt), id],
  );
};
