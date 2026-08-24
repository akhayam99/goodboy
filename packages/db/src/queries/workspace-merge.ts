import type { WorkspaceId } from '@goodboy/types';
import type { Database } from '../client';

type BindingRow = {
  readonly id: string;
  readonly provider: string;
  readonly credential_id: string;
  readonly config: string;
  readonly created_at: number;
  readonly updated_at: number;
};

type MergeCandidateRow = {
  readonly id: string;
  readonly name: string;
  readonly project_count: number;
  readonly session_count: number;
};

export type WorkspaceMergeCandidate = {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly projectCount: number;
  readonly sessionCount: number;
};

type ListCandidatesParams = {
  readonly db: Database;
  readonly targetWorkspaceId: WorkspaceId;
};

export const listWorkspaceMergeCandidates = async ({
  db,
  targetWorkspaceId,
}: ListCandidatesParams): Promise<ReadonlyArray<WorkspaceMergeCandidate>> => {
  const rows = await db.select<MergeCandidateRow>(
    `SELECT
       w.id,
       w.name,
       (SELECT COUNT(*) FROM projects p
         WHERE p.workspace_id = w.id AND p.disconnected_at IS NULL) AS project_count,
       (SELECT COUNT(*) FROM sessions s
         WHERE s.workspace_id = w.id AND s.deleted_at IS NULL) AS session_count
     FROM workspaces w
     WHERE w.deleted_at IS NULL AND w.disconnected_at IS NULL AND w.id != ?
     ORDER BY w.created_at DESC`,
    [targetWorkspaceId],
  );
  return rows.map((row) => ({
    id: row.id as WorkspaceId,
    name: row.name,
    projectCount: row.project_count,
    sessionCount: row.session_count,
  }));
};

type MergeParams = {
  readonly db: Database;
  readonly sourceWorkspaceIds: ReadonlyArray<WorkspaceId>;
  readonly targetWorkspaceId: WorkspaceId;
};

type ConfigsMatchParams = {
  readonly left: string;
  readonly right: string;
};

const configsMatch = ({ left, right }: ConfigsMatchParams): boolean => {
  if (left === right) {
    return true;
  }
  try {
    return JSON.stringify(JSON.parse(left)) === JSON.stringify(JSON.parse(right));
  } catch {
    return false;
  }
};

type MergeSourceBindingsParams = {
  readonly db: Database;
  readonly sourceId: WorkspaceId;
  readonly targetId: WorkspaceId;
};

const mergeSourceBindings = async ({
  db,
  sourceId,
  targetId,
}: MergeSourceBindingsParams): Promise<void> => {
  await db.execute(
    'UPDATE integration_bindings SET workspace_id = ? WHERE workspace_id = ? AND project_id IS NOT NULL',
    [targetId, sourceId],
  );
  const sourceRows = await db.select<BindingRow>(
    'SELECT id, provider, credential_id, config, created_at, updated_at FROM integration_bindings WHERE workspace_id = ? AND project_id IS NULL',
    [sourceId],
  );
  const sourceProjects = await db.select<{ readonly id: string }>(
    'SELECT id FROM projects WHERE workspace_id = ?',
    [sourceId],
  );
  for (const row of sourceRows) {
    const targetRows = await db.select<BindingRow>(
      'SELECT id, provider, credential_id, config, created_at, updated_at FROM integration_bindings WHERE workspace_id = ? AND project_id IS NULL AND provider = ?',
      [targetId, row.provider],
    );
    const targetRow = targetRows[0];
    if (targetRow === undefined) {
      await db.execute('UPDATE integration_bindings SET workspace_id = ? WHERE id = ?', [
        targetId,
        row.id,
      ]);
      continue;
    }
    if (sourceProjects.length === 1) {
      const projectId = sourceProjects[0]!.id;
      const occupied = await db.select<{ readonly id: string }>(
        "SELECT id FROM integration_bindings WHERE workspace_id = ? AND COALESCE(project_id, '') = ? AND provider = ?",
        [targetId, projectId, row.provider],
      );
      if (occupied.length > 0) {
        await db.execute('DELETE FROM integration_bindings WHERE id = ?', [row.id]);
        continue;
      }
      await db.execute(
        'UPDATE integration_bindings SET workspace_id = ?, project_id = ? WHERE id = ?',
        [targetId, projectId, row.id],
      );
      continue;
    }
    if (sourceProjects.length > 1 && !configsMatch({ left: row.config, right: targetRow.config })) {
      for (const project of sourceProjects) {
        const occupied = await db.select<{ readonly id: string }>(
          "SELECT id FROM integration_bindings WHERE workspace_id = ? AND COALESCE(project_id, '') = ? AND provider = ?",
          [targetId, project.id, row.provider],
        );
        if (occupied.length > 0) {
          continue;
        }
        await db.execute(
          `INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            targetId,
            project.id,
            row.provider,
            row.credential_id,
            row.config,
            row.created_at,
            row.updated_at,
          ],
        );
      }
    }
    await db.execute('DELETE FROM integration_bindings WHERE id = ?', [row.id]);
  }
};

export const mergeWorkspaces = async ({
  db,
  sourceWorkspaceIds,
  targetWorkspaceId,
}: MergeParams): Promise<void> => {
  const sources = sourceWorkspaceIds.filter((id) => id !== targetWorkspaceId);
  if (sources.length === 0) {
    return;
  }
  const targetRows = await db.select<{ readonly id: string }>(
    'SELECT id FROM workspaces WHERE id = ?',
    [targetWorkspaceId],
  );
  if (targetRows.length === 0) {
    throw new Error(`workspace not found: ${targetWorkspaceId}`);
  }
  await db.exec('BEGIN');
  try {
    for (const sourceId of sources) {
      const sourceRows = await db.select<{ readonly id: string }>(
        'SELECT id FROM workspaces WHERE id = ?',
        [sourceId],
      );
      if (sourceRows.length === 0) {
        throw new Error(`workspace not found: ${sourceId}`);
      }
      await mergeSourceBindings({ db, sourceId, targetId: targetWorkspaceId });
      await db.execute('UPDATE projects SET workspace_id = ? WHERE workspace_id = ?', [
        targetWorkspaceId,
        sourceId,
      ]);
      await db.execute('UPDATE sessions SET workspace_id = ? WHERE workspace_id = ?', [
        targetWorkspaceId,
        sourceId,
      ]);
      await db.execute('DELETE FROM workspace_profiles WHERE workspace_id = ?', [sourceId]);
      await db.execute('DELETE FROM settings WHERE key = ?', [
        `workspace.${sourceId}.branch_prefix`,
      ]);
      await db.execute('DELETE FROM workspaces WHERE id = ?', [sourceId]);
    }
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
};
