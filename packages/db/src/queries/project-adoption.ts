import type { ProjectId, WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

export type ProjectAdoptionInfo = {
  readonly sourceWorkspaceId: WorkspaceId;
  readonly isShell: boolean;
  readonly sessionCount: number;
};

type CandidateRow = {
  readonly id: string;
  readonly deleted_at: number | null;
};

type DescribeProjectAdoptionParams = {
  readonly db: Database;
  readonly projectId: ProjectId;
};

type SessionSplit = {
  readonly moved: ReadonlyArray<CandidateRow>;
  readonly ambiguous: ReadonlyArray<CandidateRow>;
};

type SplitParams = {
  readonly db: Database;
  readonly projectId: ProjectId;
  readonly sourceWorkspaceId: WorkspaceId;
};

const splitSessions = async ({
  db,
  projectId,
  sourceWorkspaceId,
}: SplitParams): Promise<SessionSplit> => {
  const candidates = await db.select<CandidateRow>(
    `SELECT DISTINCT s.id, s.deleted_at FROM sessions s
     WHERE s.workspace_id = ?
       AND (s.active_project_id = ?
            OR s.id IN (SELECT session_id FROM session_worktrees WHERE project_id = ?))`,
    [sourceWorkspaceId, projectId, projectId],
  );
  if (candidates.length === 0) {
    return { moved: [], ambiguous: [] };
  }
  const placeholders = candidates.map(() => '?').join(', ');
  const ambiguousRows = await db.select<CandidateRow>(
    `SELECT DISTINCT s.id, s.deleted_at FROM sessions s
     WHERE s.id IN (${placeholders})
       AND (s.id IN (
              SELECT sw.session_id FROM session_worktrees sw
              JOIN projects p ON p.id = sw.project_id
              WHERE p.workspace_id = ? AND sw.project_id != ?)
            OR (s.active_project_id IS NOT NULL
                AND s.active_project_id != ?
                AND s.active_project_id IN (SELECT id FROM projects WHERE workspace_id = ?)))`,
    [
      ...candidates.map((row) => row.id),
      sourceWorkspaceId,
      projectId,
      projectId,
      sourceWorkspaceId,
    ],
  );
  const ambiguousIds = new Set(ambiguousRows.map((row) => row.id));
  return {
    moved: candidates.filter((row) => !ambiguousIds.has(row.id)),
    ambiguous: ambiguousRows,
  };
};

export const describeProjectAdoption = async ({
  db,
  projectId,
}: DescribeProjectAdoptionParams): Promise<ProjectAdoptionInfo | null> => {
  const projectRows = await db.select<{ readonly workspace_id: string }>(
    'SELECT workspace_id FROM projects WHERE id = ?',
    [projectId],
  );
  const projectRow = projectRows[0];
  if (projectRow === undefined) {
    return null;
  }
  const sourceWorkspaceId = projectRow.workspace_id as WorkspaceId;
  const connectedRows = await db.select<{ readonly count: number }>(
    'SELECT COUNT(*) AS count FROM projects WHERE workspace_id = ? AND disconnected_at IS NULL',
    [sourceWorkspaceId],
  );
  const isShell = (connectedRows[0]?.count ?? 0) <= 1;
  if (isShell) {
    const sessionRows = await db.select<{ readonly count: number }>(
      'SELECT COUNT(*) AS count FROM sessions WHERE workspace_id = ? AND deleted_at IS NULL',
      [sourceWorkspaceId],
    );
    return { sourceWorkspaceId, isShell, sessionCount: sessionRows[0]?.count ?? 0 };
  }
  const { moved, ambiguous } = await splitSessions({ db, projectId, sourceWorkspaceId });
  const visible = [...moved, ...ambiguous].filter((row) => row.deleted_at === null);
  return { sourceWorkspaceId, isShell, sessionCount: visible.length };
};

export type ProjectMoveResult = {
  readonly movedSessionCount: number;
  readonly ambiguousSessionCount: number;
};

type MoveProjectToWorkspaceParams = {
  readonly db: Database;
  readonly projectId: ProjectId;
  readonly targetWorkspaceId: WorkspaceId;
};

export const moveProjectToWorkspace = async ({
  db,
  projectId,
  targetWorkspaceId,
}: MoveProjectToWorkspaceParams): Promise<ProjectMoveResult> => {
  const projectRows = await db.select<{ readonly workspace_id: string }>(
    'SELECT workspace_id FROM projects WHERE id = ?',
    [projectId],
  );
  const projectRow = projectRows[0];
  if (projectRow === undefined) {
    throw new Error(`project not found: ${projectId}`);
  }
  const sourceWorkspaceId = projectRow.workspace_id as WorkspaceId;
  if (sourceWorkspaceId === targetWorkspaceId) {
    return { movedSessionCount: 0, ambiguousSessionCount: 0 };
  }
  const targetRows = await db.select<{ readonly id: string }>(
    'SELECT id FROM workspaces WHERE id = ?',
    [targetWorkspaceId],
  );
  if (targetRows.length === 0) {
    throw new Error(`workspace not found: ${targetWorkspaceId}`);
  }
  const { moved, ambiguous } = await splitSessions({ db, projectId, sourceWorkspaceId });
  await db.exec('BEGIN');
  try {
    if (moved.length > 0) {
      const placeholders = moved.map(() => '?').join(', ');
      await db.execute(`UPDATE sessions SET workspace_id = ? WHERE id IN (${placeholders})`, [
        targetWorkspaceId,
        ...moved.map((row) => row.id),
      ]);
    }
    await db.execute('UPDATE projects SET workspace_id = ?, updated_at = ? WHERE id = ?', [
      targetWorkspaceId,
      Date.now(),
      projectId,
    ]);
    await db.execute('UPDATE integration_bindings SET workspace_id = ? WHERE project_id = ?', [
      targetWorkspaceId,
      projectId,
    ]);
    await db.execute('UPDATE permission_rules SET workspace_id = ? WHERE project_id = ?', [
      targetWorkspaceId,
      projectId,
    ]);
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
  return {
    movedSessionCount: moved.filter((row) => row.deleted_at === null).length,
    ambiguousSessionCount: ambiguous.filter((row) => row.deleted_at === null).length,
  };
};
