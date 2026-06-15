import type {
  IsoDateTime,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationId,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';
import type { Database } from '../client';

type WorkspaceIntegrationRow = {
  id: string;
  workspace_id: string;
  provider: string;
  config: string;
  credential_key: string;
  created_at: number;
  updated_at: number;
};

function toDomain(row: WorkspaceIntegrationRow): WorkspaceIntegration {
  return {
    id: row.id as WorkspaceIntegrationId,
    workspaceId: row.workspace_id as WorkspaceId,
    provider: row.provider as WorkspaceIntegrationProvider,
    config: JSON.parse(row.config),
    credentialKey: row.credential_key,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  } as WorkspaceIntegration;
}

export const upsertWorkspaceIntegration = async (
  db: Database,
  integration: WorkspaceIntegration,
): Promise<void> => {
  const created = Date.parse(integration.createdAt);
  const updated = Date.parse(integration.updatedAt);
  await db.execute(
    `INSERT INTO workspace_integrations (id, workspace_id, provider, config, credential_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id, provider) DO UPDATE SET
       config = excluded.config,
       credential_key = excluded.credential_key,
       updated_at = excluded.updated_at`,
    [
      integration.id,
      integration.workspaceId,
      integration.provider,
      JSON.stringify(integration.config),
      integration.credentialKey,
      created,
      updated,
    ],
  );
};

export const listIntegrationsForWorkspace = async (
  db: Database,
  workspaceId: WorkspaceId,
): Promise<ReadonlyArray<WorkspaceIntegration>> => {
  const rows = await db.select<WorkspaceIntegrationRow>(
    'SELECT * FROM workspace_integrations WHERE workspace_id = ? ORDER BY created_at ASC',
    [workspaceId],
  );
  return rows.map(toDomain);
};

export const getWorkspaceIntegration = async (
  db: Database,
  workspaceId: WorkspaceId,
  provider: WorkspaceIntegrationProvider,
): Promise<WorkspaceIntegration | null> => {
  const rows = await db.select<WorkspaceIntegrationRow>(
    'SELECT * FROM workspace_integrations WHERE workspace_id = ? AND provider = ? LIMIT 1',
    [workspaceId, provider],
  );
  const row = rows[0];
  return row ? toDomain(row) : null;
};

export const deleteWorkspaceIntegration = async (
  db: Database,
  workspaceId: WorkspaceId,
  provider: WorkspaceIntegrationProvider,
): Promise<void> => {
  await db.execute('DELETE FROM workspace_integrations WHERE workspace_id = ? AND provider = ?', [
    workspaceId,
    provider,
  ]);
};
