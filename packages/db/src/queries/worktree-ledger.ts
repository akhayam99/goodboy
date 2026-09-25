import type {
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  WorkspaceId,
  WorktreeLedgerEntry,
} from '@goodboy/types';
import type { Database } from '../client';

type Row = {
  readonly id: string;
  readonly workspaceId: WorkspaceId | null;
  readonly projectId: ProjectId | null;
  readonly sourceSessionId: SessionId | null;
  readonly sourceMountId: MountId | null;
  readonly repoRoot: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly reason: WorktreeLedgerEntry['reason'];
  readonly lastCheckedAt: number | null;
  readonly firstSeenAt: number;
  readonly sizeBytes: number | null;
  readonly sizedAt: number | null;
  readonly keptAt: number | null;
  readonly keptUntil: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
};

const toIso = (value: number): IsoDateTime => new Date(value).toISOString() as IsoDateTime;

const toIsoOrNull = (value: number | null): IsoDateTime | null =>
  value === null ? null : toIso(value);

const toDomain = (row: Row): WorktreeLedgerEntry => ({
  ...row,
  lastCheckedAt: toIsoOrNull(row.lastCheckedAt),
  firstSeenAt: toIso(row.firstSeenAt),
  sizedAt: toIsoOrNull(row.sizedAt),
  keptAt: toIsoOrNull(row.keptAt),
  keptUntil: toIsoOrNull(row.keptUntil),
  createdAt: toIso(row.createdAt),
  updatedAt: toIso(row.updatedAt),
});

const LEDGER_COLUMNS = `id, workspace_id AS workspaceId, project_id AS projectId,
  source_session_id AS sourceSessionId, source_mount_id AS sourceMountId,
  repo_root AS repoRoot, worktree_path AS worktreePath, branch, reason,
  last_checked_at AS lastCheckedAt, first_seen_at AS firstSeenAt,
  size_bytes AS sizeBytes, sized_at AS sizedAt, kept_at AS keptAt, kept_until AS keptUntil,
  created_at AS createdAt, updated_at AS updatedAt`;

type DbParams = {
  readonly db: Database;
};

export const listWorktreeLedger = async ({
  db,
}: DbParams): Promise<ReadonlyArray<WorktreeLedgerEntry>> => {
  const rows = await db.select<Row>(
    `SELECT ${LEDGER_COLUMNS} FROM retained_worktree_paths ORDER BY repo_root, worktree_path`,
    [],
  );
  return rows.map(toDomain);
};

export type OrphanLedgerInput = {
  readonly repoRoot: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly workspaceId: WorkspaceId | null;
  readonly projectId: ProjectId | null;
  readonly sizeBytes: number | null;
};

type RecordOrphansParams = DbParams & {
  readonly orphans: ReadonlyArray<OrphanLedgerInput>;
  readonly seenAt: IsoDateTime;
};

export const recordOrphanWorktrees = async ({
  db,
  orphans,
  seenAt,
}: RecordOrphansParams): Promise<void> => {
  if (orphans.length === 0) {
    return;
  }
  const at = Date.parse(seenAt);
  await db.transaction({
    statements: orphans.map((orphan) => ({
      sql: `INSERT INTO retained_worktree_paths
        (id, workspace_id, project_id, source_session_id, source_mount_id, repo_root,
         worktree_path, branch, reason, last_checked_at, first_seen_at, size_bytes, sized_at,
         created_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, 'orphan', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(worktree_path) DO UPDATE SET last_checked_at = excluded.last_checked_at`,
      params: [
        crypto.randomUUID(),
        orphan.workspaceId,
        orphan.projectId,
        orphan.repoRoot,
        orphan.worktreePath,
        orphan.branch,
        at,
        at,
        orphan.sizeBytes,
        orphan.sizeBytes === null ? null : at,
        at,
        at,
      ],
    })),
  });
};

type DeleteEntriesParams = DbParams & {
  readonly ids: ReadonlyArray<string>;
};

export const deleteWorktreeLedgerEntries = async ({
  db,
  ids,
}: DeleteEntriesParams): Promise<void> => {
  if (ids.length === 0) {
    return;
  }
  await db.transaction({
    statements: ids.map((id) => ({
      sql: 'DELETE FROM retained_worktree_paths WHERE id = ?',
      params: [id],
    })),
  });
};

type SetSizeParams = DbParams & {
  readonly worktreePath: string;
  readonly sizeBytes: number;
  readonly sizedAt: IsoDateTime;
};

export const setWorktreeLedgerSize = async ({
  db,
  worktreePath,
  sizeBytes,
  sizedAt,
}: SetSizeParams): Promise<void> => {
  await db.execute(
    'UPDATE retained_worktree_paths SET size_bytes = ?, sized_at = ? WHERE worktree_path = ?',
    [sizeBytes, Date.parse(sizedAt), worktreePath],
  );
};

type SetKeepParams = DbParams & {
  readonly worktreePath: string;
  readonly keptAt: IsoDateTime | null;
  readonly keptUntil: IsoDateTime | null;
};

export const setWorktreeLedgerKeep = async ({
  db,
  worktreePath,
  keptAt,
  keptUntil,
}: SetKeepParams): Promise<void> => {
  await db.execute(
    'UPDATE retained_worktree_paths SET kept_at = ?, kept_until = ?, updated_at = ? WHERE worktree_path = ?',
    [
      keptAt === null ? null : Date.parse(keptAt),
      keptUntil === null ? null : Date.parse(keptUntil),
      Date.now(),
      worktreePath,
    ],
  );
};
