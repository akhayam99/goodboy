import type { MountId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

export type StorageMountRow = {
  readonly mountId: MountId;
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly repoRoot: string | null;
  readonly worktreePath: string;
  readonly branch: string;
  readonly revision: number;
  readonly sessionGoal: string;
  readonly archivedAt: number | null;
  readonly lastActivityAt: number;
};

export type StorageSessionRef = {
  readonly sessionId: SessionId;
  readonly goal: string;
  readonly archivedAt: number | null;
  readonly deletedAt: number | null;
  readonly lastActivityAt: number;
};

type DbParams = {
  readonly db: Database;
};

export const listStorageMounts = async ({
  db,
}: DbParams): Promise<ReadonlyArray<StorageMountRow>> =>
  db.select<StorageMountRow>(
    `SELECT m.id AS mountId, m.session_id AS sessionId, s.workspace_id AS workspaceId,
            m.project_id AS projectId, p.root_path AS repoRoot, m.worktree_path AS worktreePath,
            m.branch AS branch, m.revision AS revision, s.goal AS sessionGoal,
            s.archived_at AS archivedAt,
            COALESCE(s.last_activity_at, s.updated_at) AS lastActivityAt
     FROM session_worktrees m
     JOIN sessions s ON s.id = m.session_id
     LEFT JOIN projects p ON p.id = m.project_id
     WHERE m.worktree_path IS NOT NULL AND s.deleted_at IS NULL AND m.branch != ''
     ORDER BY m.worktree_path`,
    [],
  );

type SessionRefsParams = DbParams & {
  readonly sessionIds: ReadonlyArray<SessionId>;
};

export const listStorageSessionRefs = async ({
  db,
  sessionIds,
}: SessionRefsParams): Promise<ReadonlyArray<StorageSessionRef>> => {
  if (sessionIds.length === 0) {
    return [];
  }
  const placeholders = sessionIds.map(() => '?').join(', ');
  return db.select<StorageSessionRef>(
    `SELECT id AS sessionId, goal, archived_at AS archivedAt, deleted_at AS deletedAt,
            COALESCE(last_activity_at, updated_at) AS lastActivityAt
     FROM sessions WHERE id IN (${placeholders})`,
    [...sessionIds],
  );
};
