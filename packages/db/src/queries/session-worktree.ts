import type {
  IsoDateTime,
  MountDiskState,
  MountId,
  ProjectId,
  RetainedWorktreePath,
  SessionId,
  SessionMount,
  WorkspaceId,
} from '@goodboy/types';
import type { Database, GuardedStatement, Statement } from '../client';
import { UniqueViolationError } from '../shared/errors';
import { retainedPathInsertStatement } from './retained-worktree-path';

type SessionWorktreeRow = {
  readonly id: string;
  readonly session_id: string;
  readonly worktree_path: string | null;
  readonly last_worktree_path: string | null;
  readonly branch: string;
  readonly base_branch: string | null;
  readonly parallel_index: number;
  readonly project_id: string | null;
  readonly mount_name: string | null;
  readonly repo_slug: string | null;
  readonly is_attached: number;
  readonly disk_state: MountDiskState;
  readonly revision: number;
  readonly created_at: number;
  readonly updated_at: number;
};

export type SessionWorktree = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly branch: string;
  readonly parallelIndex: number;
  readonly projectId?: ProjectId;
  readonly mountName?: string;
  readonly repoSlug?: string;
  readonly revision?: number;
  readonly createdAt: number;
};

type MountKeyParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

type ListSessionMountsParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

type InsertSessionMountParams = {
  readonly db: Database;
  readonly mount: SessionMount;
};

type UpdateSessionMountBranchParams = MountKeyParams & {
  readonly branch: string;
  readonly expectedRevision: number;
  readonly updatedAt: IsoDateTime;
};

type UpdateSessionMountLifecycleParams = MountKeyParams & {
  readonly worktreePath: string | null;
  readonly isAttached: boolean;
  readonly diskState: MountDiskState;
  readonly expectedRevision: number;
  readonly updatedAt: IsoDateTime;
};

type PathOwnerParams = {
  readonly worktreePath: string;
  readonly excludedMountId: MountId | null;
};

const PATH_OWNED = 'PATH_OWNED';

const toMount = (row: SessionWorktreeRow): SessionMount => ({
  id: row.id as MountId,
  sessionId: row.session_id as SessionId,
  projectId: row.project_id as ProjectId | null,
  worktreePath: row.worktree_path,
  lastWorktreePath: row.last_worktree_path,
  branch: row.branch,
  baseBranch: row.base_branch,
  parallelIndex: row.parallel_index,
  mountName: row.mount_name,
  repoSlug: row.repo_slug,
  isAttached: row.is_attached !== 0,
  diskState: row.disk_state,
  revision: row.revision,
  createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
  updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
});

const toPresentWorktree = (row: SessionWorktreeRow): SessionWorktree | null => {
  if (row.worktree_path === null) {
    return null;
  }
  return {
    id: row.id,
    sessionId: row.session_id as SessionId,
    worktreePath: row.worktree_path,
    branch: row.branch,
    parallelIndex: row.parallel_index,
    ...(row.project_id !== null ? { projectId: row.project_id as ProjectId } : {}),
    ...(row.mount_name !== null ? { mountName: row.mount_name } : {}),
    ...(row.repo_slug !== null ? { repoSlug: row.repo_slug } : {}),
    revision: row.revision,
    createdAt: row.created_at,
  };
};

const pathOwnerStatement = ({
  worktreePath,
  excludedMountId,
}: PathOwnerParams): GuardedStatement => ({
  sql: `SELECT 'mount' AS source
     FROM session_worktrees mount
     JOIN sessions s ON s.id = mount.session_id
     WHERE mount.worktree_path = ? AND s.deleted_at IS NULL AND (? IS NULL OR mount.id != ?)
     UNION ALL
     SELECT 'retained' AS source
     FROM retained_worktree_paths
     WHERE worktree_path = ? AND reason != 'orphan'
     LIMIT 1`,
  params: [worktreePath, excludedMountId, excludedMountId, worktreePath],
  abortWhen: 'rows',
  abortCode: PATH_OWNED,
});

type PathOwnerGuardParams = {
  readonly worktreePath: string | null;
  readonly excludedMountId: MountId | null;
};

const pathOwnerGuards = ({
  worktreePath,
  excludedMountId,
}: PathOwnerGuardParams): ReadonlyArray<Statement> =>
  worktreePath === null ? [] : [pathOwnerStatement({ worktreePath, excludedMountId })];

export const insertSessionMount = async ({
  db,
  mount,
}: InsertSessionMountParams): Promise<void> => {
  const outcome = await db.transaction({
    statements: [
      ...pathOwnerGuards({ worktreePath: mount.worktreePath, excludedMountId: null }),
      {
        sql: `INSERT INTO session_worktrees
          (id, session_id, worktree_path, last_worktree_path, branch, base_branch, parallel_index,
           project_id, mount_name, repo_slug, is_attached, disk_state, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          mount.id,
          mount.sessionId,
          mount.worktreePath,
          mount.lastWorktreePath,
          mount.branch,
          mount.baseBranch,
          mount.parallelIndex,
          mount.projectId,
          mount.mountName,
          mount.repoSlug,
          mount.isAttached ? 1 : 0,
          mount.diskState,
          mount.revision,
          Date.parse(mount.createdAt),
          Date.parse(mount.updatedAt),
        ],
      },
    ],
  });
  if (outcome.status === 'aborted') {
    throw new UniqueViolationError('session mount', 'worktreePath');
  }
};

export const getSessionMount = async ({
  db,
  sessionId,
  mountId,
}: MountKeyParams): Promise<SessionMount | null> => {
  const rows = await db.select<SessionWorktreeRow>(
    'SELECT * FROM session_worktrees WHERE session_id = ? AND id = ? LIMIT 1',
    [sessionId, mountId],
  );
  const row = rows[0];
  return row === undefined ? null : toMount(row);
};

export const listSessionMounts = async ({
  db,
  sessionId,
}: ListSessionMountsParams): Promise<ReadonlyArray<SessionMount>> => {
  const rows = await db.select<SessionWorktreeRow>(
    'SELECT * FROM session_worktrees WHERE session_id = ? ORDER BY parallel_index, created_at, id',
    [sessionId],
  );
  return rows.map(toMount);
};

export const updateSessionMountBranch = async ({
  db,
  sessionId,
  mountId,
  branch,
  expectedRevision,
  updatedAt,
}: UpdateSessionMountBranchParams): Promise<boolean> => {
  const result = await db.execute(
    `UPDATE session_worktrees
     SET branch = ?, revision = revision + 1, updated_at = ?
     WHERE session_id = ? AND id = ? AND revision = ?`,
    [branch, Date.parse(updatedAt), sessionId, mountId, expectedRevision],
  );
  return result.rowsAffected > 0;
};

export const deleteSessionMount = async ({
  db,
  sessionId,
  mountId,
}: MountKeyParams): Promise<boolean> => {
  const outcome = await db.transaction({
    statements: [
      {
        sql: `UPDATE sessions SET active_mount_id = NULL, active_project_id = NULL
       WHERE id = ? AND active_mount_id = ?`,
        params: [sessionId, mountId],
      },
      {
        sql: 'DELETE FROM session_worktrees WHERE session_id = ? AND id = ?',
        params: [sessionId, mountId],
      },
    ],
  });
  return outcome.status === 'committed' && (outcome.results[1]?.rowsAffected ?? 0) > 0;
};

const STALE_REVISION = 'STALE_REVISION';

export const updateSessionMountLifecycle = async ({
  db,
  sessionId,
  mountId,
  worktreePath,
  isAttached,
  diskState,
  expectedRevision,
  updatedAt,
}: UpdateSessionMountLifecycleParams): Promise<boolean> => {
  const outcome = await db.transaction({
    statements: [
      ...pathOwnerGuards({ worktreePath, excludedMountId: mountId }),
      {
        sql: `UPDATE session_worktrees
         SET worktree_path = ?,
             last_worktree_path = COALESCE(?, worktree_path, last_worktree_path),
             is_attached = ?, disk_state = ?, revision = revision + 1, updated_at = ?
         WHERE session_id = ? AND id = ? AND revision = ?`,
        params: [
          worktreePath,
          worktreePath,
          isAttached ? 1 : 0,
          diskState,
          Date.parse(updatedAt),
          sessionId,
          mountId,
          expectedRevision,
        ],
        abortWhen: 'noChanges',
        abortCode: STALE_REVISION,
      },
    ],
  });
  if (outcome.status === 'aborted' && outcome.abortCode === PATH_OWNED) {
    throw new UniqueViolationError('session mount', 'worktreePath');
  }
  return outcome.status === 'committed';
};

export const insertSessionWorktree = async (
  db: Database,
  worktree: SessionWorktree,
): Promise<void> => {
  const createdAt = new Date(worktree.createdAt).toISOString() as IsoDateTime;
  await insertSessionMount({
    db,
    mount: {
      id: worktree.id as MountId,
      sessionId: worktree.sessionId,
      projectId: worktree.projectId ?? null,
      worktreePath: worktree.worktreePath,
      lastWorktreePath: worktree.worktreePath,
      branch: worktree.branch,
      baseBranch: null,
      parallelIndex: worktree.parallelIndex,
      mountName: worktree.mountName ?? null,
      repoSlug: worktree.repoSlug ?? null,
      isAttached: true,
      diskState: 'unchecked',
      revision: 0,
      createdAt,
      updatedAt: createdAt,
    },
  });
};

export const listWorktreesForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<ReadonlyArray<SessionWorktree>> => {
  const rows = await db.select<SessionWorktreeRow>(
    `SELECT * FROM session_worktrees
     WHERE session_id = ? AND worktree_path IS NOT NULL AND is_attached = 1
     ORDER BY parallel_index, created_at, id`,
    [sessionId],
  );
  return rows.flatMap((row) => {
    const worktree = toPresentWorktree(row);
    return worktree === null ? [] : [worktree];
  });
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
    `SELECT * FROM session_worktrees
     WHERE session_id IN (${placeholders}) AND worktree_path IS NOT NULL AND is_attached = 1
     ORDER BY session_id, parallel_index, created_at, id`,
    sessionIds,
  );
  for (const row of rows) {
    const worktree = toPresentWorktree(row);
    if (worktree === null) {
      continue;
    }
    const bucket = out.get(worktree.sessionId) ?? [];
    bucket.push(worktree);
    out.set(worktree.sessionId, bucket);
  }
  return out;
};

export const deleteWorktreesForSession = async (
  db: Database,
  sessionId: SessionId,
): Promise<void> => {
  await db.transaction({
    statements: [
      { sql: 'UPDATE sessions SET active_mount_id = NULL WHERE id = ?', params: [sessionId] },
      {
        sql: `UPDATE session_worktrees
         SET last_worktree_path = COALESCE(worktree_path, last_worktree_path), worktree_path = NULL,
             is_attached = 0, disk_state = 'removed', revision = revision + 1, updated_at = ?
         WHERE session_id = ?`,
        params: [Date.now(), sessionId],
      },
    ],
  });
};

export const updateSessionWorktreeBranch = async (
  db: Database,
  sessionId: SessionId,
  parallelIndex: number,
  branch: string,
): Promise<void> => {
  await db.execute(
    `UPDATE session_worktrees
     SET branch = ?, revision = revision + 1, updated_at = ?
     WHERE session_id = ? AND parallel_index = ?`,
    [branch, Date.now(), sessionId, parallelIndex],
  );
};

type UpdateSessionWorktreeRepoSlugParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly repoSlug: string;
};

export const updateSessionWorktreeRepoSlug = async ({
  db,
  sessionId,
  worktreePath,
  repoSlug,
}: UpdateSessionWorktreeRepoSlugParams): Promise<void> => {
  await db.execute(
    `UPDATE session_worktrees
     SET repo_slug = ?, revision = revision + 1, updated_at = ?
     WHERE session_id = ? AND worktree_path = ?`,
    [repoSlug, Date.now(), sessionId, worktreePath],
  );
};

export const listAllSessionWorktrees = async (
  db: Database,
): Promise<ReadonlyArray<SessionWorktree>> => {
  const rows = await db.select<SessionWorktreeRow>(
    `SELECT mount.* FROM session_worktrees mount
     JOIN sessions s ON s.id = mount.session_id
     WHERE s.deleted_at IS NULL AND mount.worktree_path IS NOT NULL AND mount.is_attached = 1`,
    [],
  );
  return rows.flatMap((row) => {
    const worktree = toPresentWorktree(row);
    return worktree === null ? [] : [worktree];
  });
};

export type MountPathOwnership = {
  readonly mountId: MountId;
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly worktreePath: string;
  readonly branch: string;
  readonly revision: number;
  readonly isSessionDeleted: boolean;
  readonly isSessionArchived: boolean;
};

type OwnershipRow = {
  readonly mountId: string;
  readonly sessionId: string;
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly worktreePath: string;
  readonly branch: string;
  readonly revision: number;
  readonly isSessionDeleted: number;
  readonly isSessionArchived: number;
};

export const listArchivedSessionMounts = async (
  db: Database,
): Promise<ReadonlyArray<SessionMount>> => {
  const rows = await db.select<SessionWorktreeRow>(
    `SELECT mount.* FROM session_worktrees mount
     JOIN sessions s ON s.id = mount.session_id
     WHERE s.archived_at IS NOT NULL AND s.deleted_at IS NULL AND mount.worktree_path IS NOT NULL
     ORDER BY mount.session_id, mount.parallel_index, mount.created_at, mount.id`,
    [],
  );
  return rows.map(toMount);
};

export const listMountPathOwnership = async (
  db: Database,
): Promise<ReadonlyArray<MountPathOwnership>> => {
  const rows = await db.select<OwnershipRow>(
    `SELECT mount.id AS mountId, mount.session_id AS sessionId, s.workspace_id AS workspaceId,
            mount.project_id AS projectId, mount.worktree_path AS worktreePath,
            mount.branch AS branch, mount.revision AS revision,
            CASE WHEN s.deleted_at IS NULL THEN 0 ELSE 1 END AS isSessionDeleted,
            CASE WHEN s.archived_at IS NULL THEN 0 ELSE 1 END AS isSessionArchived
     FROM session_worktrees mount
     JOIN sessions s ON s.id = mount.session_id
     WHERE mount.worktree_path IS NOT NULL
     ORDER BY mount.worktree_path`,
    [],
  );
  return rows.map((row) => ({
    mountId: row.mountId as MountId,
    sessionId: row.sessionId as SessionId,
    workspaceId: row.workspaceId as WorkspaceId,
    projectId: row.projectId === null ? null : (row.projectId as ProjectId),
    worktreePath: row.worktreePath,
    branch: row.branch,
    revision: row.revision,
    isSessionDeleted: row.isSessionDeleted !== 0,
    isSessionArchived: row.isSessionArchived !== 0,
  }));
};

export type MountDetachment = {
  readonly mountId: MountId;
  readonly diskState: MountDiskState;
};

type DetachSessionMountsParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly detached: ReadonlyArray<MountDetachment>;
  readonly retained: ReadonlyArray<RetainedWorktreePath>;
};

const DETACH_MOUNT_SQL = `UPDATE session_worktrees
   SET last_worktree_path = COALESCE(worktree_path, last_worktree_path), worktree_path = NULL,
       is_attached = 0, disk_state = ?, revision = revision + 1, updated_at = ?`;

export const detachSessionMounts = async ({
  db,
  sessionId,
  detached,
  retained,
}: DetachSessionMountsParams): Promise<void> => {
  const now = Date.now();
  await db.transaction({
    statements: [
      { sql: 'UPDATE sessions SET active_mount_id = NULL WHERE id = ?', params: [sessionId] },
      ...detached.map((mount) => ({
        sql: `${DETACH_MOUNT_SQL} WHERE session_id = ? AND id = ?`,
        params: [mount.diskState, now, sessionId, mount.mountId],
      })),
      {
        sql: `${DETACH_MOUNT_SQL} WHERE session_id = ? AND worktree_path IS NOT NULL`,
        params: ['unchecked', now, sessionId],
      },
      ...retained.flatMap((path) => [
        {
          sql: 'DELETE FROM retained_worktree_paths WHERE worktree_path = ?',
          params: [path.worktreePath],
        },
        retainedPathInsertStatement({ retained: path }),
      ]),
    ],
  });
};
