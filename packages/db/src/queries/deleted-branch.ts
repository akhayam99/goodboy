import type { DeletedBranch, IsoDateTime, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

type Row = {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
  readonly sessionId: SessionId | null;
  readonly repoRoot: string;
  readonly branch: string;
  readonly sha: string;
  readonly keepRef: string;
  readonly onOrigin: number;
  readonly deletedAt: number;
  readonly restoredAt: number | null;
};

const COLUMNS = `id, workspace_id AS workspaceId, project_id AS projectId, session_id AS sessionId,
  repo_root AS repoRoot, branch, sha, keep_ref AS keepRef, on_origin AS onOrigin,
  deleted_at AS deletedAt, restored_at AS restoredAt`;

const toIso = (ms: number): IsoDateTime => new Date(ms).toISOString() as IsoDateTime;

const toDomain = (row: Row): DeletedBranch => ({
  ...row,
  onOrigin: row.onOrigin !== 0,
  deletedAt: toIso(row.deletedAt),
  restoredAt: row.restoredAt === null ? null : toIso(row.restoredAt),
});

type InsertDeletedBranchParams = {
  readonly db: Database;
  readonly entry: DeletedBranch;
};

export const insertDeletedBranch = async ({
  db,
  entry,
}: InsertDeletedBranchParams): Promise<void> => {
  await db.execute(
    `INSERT INTO deleted_branches
       (id, workspace_id, project_id, session_id, repo_root, branch, sha, keep_ref, on_origin,
        deleted_at, restored_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.workspaceId,
      entry.projectId,
      entry.sessionId,
      entry.repoRoot,
      entry.branch,
      entry.sha,
      entry.keepRef,
      entry.onOrigin ? 1 : 0,
      Date.parse(entry.deletedAt),
      entry.restoredAt === null ? null : Date.parse(entry.restoredAt),
    ],
  );
};

type ListDeletedBranchesParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const listDeletedBranches = async ({
  db,
  workspaceId,
}: ListDeletedBranchesParams): Promise<ReadonlyArray<DeletedBranch>> => {
  const rows = await db.select<Row>(
    `SELECT ${COLUMNS} FROM deleted_branches
     WHERE workspace_id = ? ORDER BY deleted_at DESC, id`,
    [workspaceId],
  );
  return rows.map(toDomain);
};

type GetDeletedBranchParams = {
  readonly db: Database;
  readonly id: string;
};

export const getDeletedBranch = async ({
  db,
  id,
}: GetDeletedBranchParams): Promise<DeletedBranch | null> => {
  const rows = await db.select<Row>(`SELECT ${COLUMNS} FROM deleted_branches WHERE id = ?`, [id]);
  const row = rows[0];
  return row === undefined ? null : toDomain(row);
};

type MarkDeletedBranchRestoredParams = {
  readonly db: Database;
  readonly id: string;
  readonly restoredAt: IsoDateTime;
};

export const markDeletedBranchRestored = async ({
  db,
  id,
  restoredAt,
}: MarkDeletedBranchRestoredParams): Promise<void> => {
  await db.execute(
    'UPDATE deleted_branches SET restored_at = ? WHERE id = ? AND restored_at IS NULL',
    [Date.parse(restoredAt), id],
  );
};

type ListExpiredDeletedBranchesParams = {
  readonly db: Database;
  readonly before: IsoDateTime;
};

export const listExpiredDeletedBranches = async ({
  db,
  before,
}: ListExpiredDeletedBranchesParams): Promise<ReadonlyArray<DeletedBranch>> => {
  const rows = await db.select<Row>(
    `SELECT ${COLUMNS} FROM deleted_branches
     WHERE restored_at IS NULL AND deleted_at < ? ORDER BY deleted_at, id`,
    [Date.parse(before)],
  );
  return rows.map(toDomain);
};

type ForgetDeletedBranchParams = {
  readonly db: Database;
  readonly id: string;
};

export const forgetDeletedBranch = async ({ db, id }: ForgetDeletedBranchParams): Promise<void> => {
  await db.execute('DELETE FROM deleted_branches WHERE id = ?', [id]);
};
