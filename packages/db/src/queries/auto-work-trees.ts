import { brandId, type AutoTreeId, type SessionId, type WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

export type AutoWorkTree = Readonly<{
  treeId: AutoTreeId;
  sessionId: SessionId;
  sessionGoal: string;
  projectId: string | null;
  branches: ReadonlyArray<string>;
}>;

type TreeRow = {
  readonly tree_id: string;
  readonly session_id: string;
  readonly goal: string;
  readonly project_id: string | null;
};

type BranchRow = {
  readonly tree_id: string;
  readonly branch: string;
};

type Params = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

const OPEN_SESSION_SQL = 's.workspace_id = ? AND s.deleted_at IS NULL AND s.archived_at IS NULL';

export const listAutoWorkTreesOfWorkspace = async ({
  db,
  workspaceId,
}: Params): Promise<ReadonlyArray<AutoWorkTree>> => {
  const [trees, branchRows] = await Promise.all([
    db.select<TreeRow>(
      `SELECT t.id AS tree_id, t.session_id AS session_id, s.goal AS goal,
         (SELECT w.project_id FROM session_worktrees w WHERE w.id = t.primary_mount_id) AS project_id
       FROM auto_trees t JOIN sessions s ON s.id = t.session_id
       WHERE ${OPEN_SESSION_SQL}
       ORDER BY t.created_at, t.id`,
      [workspaceId],
    ),
    db.select<BranchRow>(
      `SELECT t.id AS tree_id, w.branch AS branch
         FROM auto_trees t
         JOIN sessions s ON s.id = t.session_id
         JOIN session_worktrees w ON w.id = t.primary_mount_id
         WHERE ${OPEN_SESSION_SQL}
       UNION
       SELECT t.id AS tree_id, w.branch AS branch
         FROM auto_trees t
         JOIN sessions s ON s.id = t.session_id
         JOIN auto_delegations d ON d.tree_id = t.id AND d.generation = t.generation
         JOIN session_worktrees w ON w.id = json_extract(d.target_json, '$.mountId')
         WHERE ${OPEN_SESSION_SQL}
       ORDER BY 1, 2`,
      [workspaceId, workspaceId],
    ),
  ]);
  return trees.map((row) => ({
    treeId: brandId<AutoTreeId>({ value: row.tree_id }),
    sessionId: brandId<SessionId>({ value: row.session_id }),
    sessionGoal: row.goal,
    projectId: row.project_id,
    branches: branchRows.filter((branch) => branch.tree_id === row.tree_id).map((b) => b.branch),
  }));
};
