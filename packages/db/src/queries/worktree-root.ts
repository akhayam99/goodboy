import type {
  IsoDateTime,
  ProjectId,
  WorkspaceId,
  WorktreeRoot,
  WorktreeRootSource,
} from '@goodboy/types';
import type { Database } from '../client';

type Row = {
  readonly repoRoot: string;
  readonly firstSeenAt: number;
  readonly lastScannedAt: number | null;
  readonly addedBy: WorktreeRootSource;
  readonly projectId: ProjectId | null;
  readonly projectName: string | null;
  readonly workspaceId: WorkspaceId | null;
  readonly workspaceName: string | null;
  readonly disconnectedAt: number | null;
};

const toDomain = (row: Row): WorktreeRoot => ({
  repoRoot: row.repoRoot,
  firstSeenAt: new Date(row.firstSeenAt).toISOString() as IsoDateTime,
  lastScannedAt:
    row.lastScannedAt === null ? null : (new Date(row.lastScannedAt).toISOString() as IsoDateTime),
  addedBy: row.addedBy,
  projectId: row.projectId,
  projectName: row.projectName,
  workspaceId: row.workspaceId,
  workspaceName: row.workspaceName,
  isDisconnected: row.projectId !== null && row.disconnectedAt !== null,
});

type DbParams = {
  readonly db: Database;
};

export const listWorktreeRoots = async ({ db }: DbParams): Promise<ReadonlyArray<WorktreeRoot>> => {
  const rows = await db.select<Row>(
    `SELECT r.repo_root AS repoRoot, r.first_seen_at AS firstSeenAt,
            r.last_scanned_at AS lastScannedAt, r.added_by AS addedBy,
            p.id AS projectId, p.name AS projectName, p.workspace_id AS workspaceId,
            w.name AS workspaceName, p.disconnected_at AS disconnectedAt
     FROM worktree_roots r
     LEFT JOIN projects p ON p.root_path = r.repo_root AND p.kind = 'repo'
     LEFT JOIN workspaces w ON w.id = p.workspace_id
     ORDER BY r.repo_root`,
    [],
  );
  return rows.map(toDomain);
};

type RegisterRootParams = DbParams & {
  readonly repoRoot: string;
  readonly addedBy: WorktreeRootSource;
};

export const registerWorktreeRoot = async ({
  db,
  repoRoot,
  addedBy,
}: RegisterRootParams): Promise<void> => {
  if (repoRoot.trim() === '') {
    return;
  }
  await db.execute(
    `INSERT INTO worktree_roots (repo_root, first_seen_at, added_by)
     VALUES (?, ?, ?)
     ON CONFLICT(repo_root) DO NOTHING`,
    [repoRoot, Date.now(), addedBy],
  );
};

type MarkScannedParams = DbParams & {
  readonly repoRoot: string;
  readonly scannedAt: IsoDateTime;
};

export const markWorktreeRootScanned = async ({
  db,
  repoRoot,
  scannedAt,
}: MarkScannedParams): Promise<void> => {
  await db.execute('UPDATE worktree_roots SET last_scanned_at = ? WHERE repo_root = ?', [
    Date.parse(scannedAt),
    repoRoot,
  ]);
};
