import {
  countWorkspacesPerIntegrationCredential,
  deleteIntegrationCredential,
  deleteWorkspaceIntegration,
  getWorkspaceIntegration,
  upsertIntegrationCredential,
  upsertWorkspaceIntegration,
} from '@goodboy/db';
import type {
  IntegrationCredential,
  IntegrationCredentialId,
  IsoDateTime,
  ProjectId,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationConfig,
  WorkspaceIntegrationId,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type NewCredential = {
  readonly label: string;
  readonly account: string;
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly workspaceId: WorkspaceId;
  readonly provider: WorkspaceIntegrationProvider;
  readonly credentialId: IntegrationCredentialId;
  readonly config: WorkspaceIntegrationConfig;
  readonly newCredential: NewCredential | null;
  readonly storeSecret: () => Promise<void>;
};

type RollbackParams = {
  readonly projectId: ProjectId;
  readonly provider: WorkspaceIntegrationProvider;
  readonly existing: WorkspaceIntegration | null;
  readonly created: IntegrationCredential | null;
};

const rollback = async ({
  projectId,
  provider,
  existing,
  created,
}: RollbackParams): Promise<void> => {
  if (existing !== null) {
    await upsertWorkspaceIntegration(tauriDatabase, existing);
    return;
  }
  await deleteWorkspaceIntegration(tauriDatabase, projectId, provider);
  if (created !== null) {
    await deleteIntegrationCredential(tauriDatabase, created.id);
  }
};

export const commitIntegrationConnection = async ({
  set,
  get,
  workspaceId,
  provider,
  credentialId,
  config,
  newCredential,
  storeSecret,
}: Params): Promise<void> => {
  const project = get().projects.find((candidate) => candidate.workspaceId === workspaceId);
  if (project === undefined) {
    throw new Error(`workspace has no projects: ${workspaceId}`);
  }
  const now = new Date().toISOString() as IsoDateTime;
  const label = newCredential === null ? '' : newCredential.label.trim();
  const created: IntegrationCredential | null =
    newCredential === null
      ? null
      : {
          id: credentialId,
          provider,
          label: label === '' ? provider : label,
          account: newCredential.account,
          createdAt: now,
          updatedAt: now,
        };
  if (created !== null) {
    await upsertIntegrationCredential(tauriDatabase, created);
  }

  const existing = await getWorkspaceIntegration(tauriDatabase, project.id, provider);
  const integration = {
    id: (existing?.id ?? crypto.randomUUID()) as WorkspaceIntegrationId,
    workspaceId: project.id,
    provider,
    config,
    credentialId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  } as WorkspaceIntegration;
  await upsertWorkspaceIntegration(tauriDatabase, integration);

  try {
    await storeSecret();
  } catch (storeError) {
    try {
      await rollback({ projectId: project.id, provider, existing, created });
    } finally {
      throw storeError;
    }
  }

  const usage = await countWorkspacesPerIntegrationCredential(tauriDatabase);
  set((state) => {
    const current = state.workspaceIntegrations[workspaceId] ?? [];
    const rest = current.filter((candidate) => candidate.provider !== provider);
    const credentials =
      created === null
        ? state.integrationCredentials
        : [...state.integrationCredentials.filter((held) => held.id !== created.id), created];
    return {
      workspaceIntegrations: {
        ...state.workspaceIntegrations,
        [workspaceId]: [...rest, integration],
      },
      integrationCredentials: credentials,
      integrationCredentialUsage: usage,
    };
  });
};
