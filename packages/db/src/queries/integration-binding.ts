import type {
  IntegrationBindingProvider,
  IntegrationCredentialId,
  IsoDateTime,
  ProjectId,
  WorkspaceId,
  IntegrationBinding,
  IntegrationBindingId,
} from '@goodboy/types';
import type { Database } from '../client';

type IntegrationBindingRow = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  provider: string;
  credential_id: string;
  config: string;
  created_at: number;
  updated_at: number;
};

const toDomain = (row: IntegrationBindingRow): IntegrationBinding =>
  ({
    id: row.id as IntegrationBindingId,
    workspaceId: row.workspace_id as WorkspaceId,
    projectId: (row.project_id as ProjectId | null) ?? null,
    provider: row.provider as IntegrationBindingProvider,
    config: JSON.parse(row.config),
    credentialId: row.credential_id as IntegrationCredentialId,
    createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
    updatedAt: new Date(row.updated_at).toISOString() as IsoDateTime,
  }) as IntegrationBinding;

type UpsertParams = {
  readonly db: Database;
  readonly binding: IntegrationBinding;
};

export const upsertIntegrationBinding = async ({ db, binding }: UpsertParams): Promise<void> => {
  await db.execute(
    `INSERT INTO integration_bindings (id, workspace_id, project_id, provider, credential_id, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (workspace_id, COALESCE(project_id, ''), provider) DO UPDATE SET
       config = excluded.config,
       credential_id = excluded.credential_id,
       updated_at = excluded.updated_at`,
    [
      binding.id,
      binding.workspaceId,
      binding.projectId,
      binding.provider,
      binding.credentialId,
      JSON.stringify(binding.config),
      Date.parse(binding.createdAt),
      Date.parse(binding.updatedAt),
    ],
  );
};

type ListParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
};

export const listIntegrationBindingsForWorkspace = async ({
  db,
  workspaceId,
}: ListParams): Promise<ReadonlyArray<IntegrationBinding>> => {
  const rows = await db.select<IntegrationBindingRow>(
    `SELECT * FROM integration_bindings
     WHERE workspace_id = ?
     ORDER BY provider ASC, project_id IS NOT NULL, created_at ASC`,
    [workspaceId],
  );
  return rows.map(toDomain);
};

type GetParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly provider: IntegrationBindingProvider;
  readonly projectId: ProjectId | null;
};

export const getIntegrationBinding = async ({
  db,
  workspaceId,
  provider,
  projectId,
}: GetParams): Promise<IntegrationBinding | null> => {
  const rows = await db.select<IntegrationBindingRow>(
    `SELECT * FROM integration_bindings
     WHERE workspace_id = ? AND provider = ? AND COALESCE(project_id, '') = COALESCE(?, '')
     LIMIT 1`,
    [workspaceId, provider, projectId],
  );
  const row = rows[0];
  return row === undefined ? null : toDomain(row);
};

type DeleteScopeParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly provider: IntegrationBindingProvider;
  readonly projectId: ProjectId | null;
};

export const deleteIntegrationBinding = async ({
  db,
  workspaceId,
  provider,
  projectId,
}: DeleteScopeParams): Promise<void> => {
  await db.execute(
    `DELETE FROM integration_bindings
     WHERE workspace_id = ? AND provider = ? AND COALESCE(project_id, '') = COALESCE(?, '')`,
    [workspaceId, provider, projectId],
  );
};

type DeleteProviderParams = {
  readonly db: Database;
  readonly workspaceId: WorkspaceId;
  readonly provider: IntegrationBindingProvider;
};

export const deleteIntegrationBindingsForProvider = async ({
  db,
  workspaceId,
  provider,
}: DeleteProviderParams): Promise<void> => {
  await db.execute('DELETE FROM integration_bindings WHERE workspace_id = ? AND provider = ?', [
    workspaceId,
    provider,
  ]);
};
