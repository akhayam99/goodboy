import type { ProjectId, SessionId } from '@goodboy/types';
import type { Database } from '../client';

export type GoodboyBranch = {
  readonly projectId: ProjectId;
  readonly branch: string;
  readonly sessionId: SessionId | null;
};

type Row = {
  readonly projectId: string;
  readonly branch: string;
  readonly sessionId: string | null;
  readonly createdAt: number;
};

type ListGoodboyBranchesParams = {
  readonly db: Database;
  readonly projectId: ProjectId;
};

export const listGoodboyBranches = async ({
  db,
  projectId,
}: ListGoodboyBranchesParams): Promise<ReadonlyArray<GoodboyBranch>> => {
  const rows = await db.select<Row>(
    `SELECT mount.project_id AS projectId, mount.branch AS branch,
            CASE WHEN s.deleted_at IS NULL THEN mount.session_id ELSE NULL END AS sessionId,
            mount.created_at AS createdAt
     FROM session_worktrees mount
     JOIN sessions s ON s.id = mount.session_id
     WHERE mount.project_id = ? AND mount.branch != ''
     UNION ALL
     SELECT project_id AS projectId, branch, NULL AS sessionId, created_at AS createdAt
     FROM retained_worktree_paths
     WHERE project_id = ? AND branch != ''
     ORDER BY createdAt DESC`,
    [projectId, projectId],
  );
  const byBranch = new Map<string, GoodboyBranch>();
  for (const row of rows) {
    const known = byBranch.get(row.branch);
    if (known !== undefined && (known.sessionId !== null || row.sessionId === null)) {
      continue;
    }
    byBranch.set(row.branch, {
      projectId: row.projectId as ProjectId,
      branch: row.branch,
      sessionId: row.sessionId as SessionId | null,
    });
  }
  return [...byBranch.values()];
};
