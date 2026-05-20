import type { OverrideSettings, SessionId, WorkflowId, WorkspaceId } from '@goodboy/types';
import type { ProviderId } from '@goodboy/types';
import type { Database } from '../client';

interface OverrideRow {
  default_provider_id: string | null;
  default_workflow_id: string | null;
  default_branch_prefix: string | null;
  parallel_enabled: number | null;
}

function rowToOverride(row: OverrideRow): OverrideSettings {
  return {
    defaultProviderId: row.default_provider_id as ProviderId | null,
    defaultWorkflowId: row.default_workflow_id as WorkflowId | null,
    defaultBranchPrefix: row.default_branch_prefix,
    parallelEnabled: row.parallel_enabled === null ? null : row.parallel_enabled !== 0,
  };
}

export async function getWorkspaceOverrides(
  db: Database,
  workspaceId: WorkspaceId,
): Promise<OverrideSettings | null> {
  const rows = await db.select<OverrideRow>(
    `SELECT default_provider_id, default_workflow_id, default_branch_prefix, parallel_enabled
     FROM workspaces WHERE id = ?`,
    [workspaceId],
  );
  const row = rows[0];
  return row ? rowToOverride(row) : null;
}

export async function setWorkspaceOverrides(
  db: Database,
  workspaceId: WorkspaceId,
  overrides: OverrideSettings,
): Promise<void> {
  await db.execute(
    `UPDATE workspaces
     SET default_provider_id = ?,
         default_workflow_id = ?,
         default_branch_prefix = ?,
         parallel_enabled = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      overrides.defaultProviderId,
      overrides.defaultWorkflowId,
      overrides.defaultBranchPrefix,
      overrides.parallelEnabled === null ? null : overrides.parallelEnabled ? 1 : 0,
      Date.now(),
      workspaceId,
    ],
  );
}

export async function getSessionOverrides(
  db: Database,
  sessionId: SessionId,
): Promise<OverrideSettings | null> {
  const rows = await db.select<OverrideRow>(
    `SELECT default_provider_id, default_workflow_id, default_branch_prefix, parallel_enabled
     FROM sessions WHERE id = ?`,
    [sessionId],
  );
  const row = rows[0];
  return row ? rowToOverride(row) : null;
}

export async function setSessionOverrides(
  db: Database,
  sessionId: SessionId,
  overrides: OverrideSettings,
): Promise<void> {
  await db.execute(
    `UPDATE sessions
     SET default_provider_id = ?,
         default_workflow_id = ?,
         default_branch_prefix = ?,
         parallel_enabled = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      overrides.defaultProviderId,
      overrides.defaultWorkflowId,
      overrides.defaultBranchPrefix,
      overrides.parallelEnabled === null ? null : overrides.parallelEnabled ? 1 : 0,
      Date.now(),
      sessionId,
    ],
  );
}
