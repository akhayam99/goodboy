import {
  countWorkspacesPerIntegrationCredential,
  deleteIntegrationBinding,
  deleteIntegrationCredential,
  getIntegrationBinding,
  upsertIntegrationBinding,
  upsertIntegrationCredential,
} from '@goodboy/db';
import type {
  IntegrationCredential,
  IntegrationCredentialId,
  IsoDateTime,
  ProjectId,
  WorkspaceId,
  IntegrationBinding,
  IntegrationBindingConfig,
  IntegrationBindingId,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type NewCredential = {
  readonly label: string;
  readonly account: string;
};

type Params = {
  readonly set: SetFn;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly provider: WorkspaceIntegrationProvider;
  readonly credentialId: IntegrationCredentialId;
  readonly config: IntegrationBindingConfig;
  readonly newCredential: NewCredential | null;
  readonly storeSecret: () => Promise<void>;
};

type RollbackParams = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
  readonly provider: WorkspaceIntegrationProvider;
  readonly existing: IntegrationBinding | null;
  readonly created: IntegrationCredential | null;
};

const rollback = async ({
  workspaceId,
  projectId,
  provider,
  existing,
  created,
}: RollbackParams): Promise<void> => {
  if (existing !== null) {
    await upsertIntegrationBinding({ db: tauriDatabase, binding: existing });
    return;
  }
  await deleteIntegrationBinding({ db: tauriDatabase, workspaceId, provider, projectId });
  if (created !== null) {
    await deleteIntegrationCredential(tauriDatabase, created.id);
  }
};

export const commitIntegrationConnection = async ({
  set,
  workspaceId,
  projectId,
  provider,
  credentialId,
  config,
  newCredential,
  storeSecret,
}: Params): Promise<void> => {
  const scope = projectId ?? null;
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

  const existing = await getIntegrationBinding({
    db: tauriDatabase,
    workspaceId,
    provider,
    projectId: scope,
  });
  const binding = {
    id: (existing?.id ?? crypto.randomUUID()) as IntegrationBindingId,
    workspaceId,
    projectId: scope,
    provider,
    config,
    credentialId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  } as IntegrationBinding;
  await upsertIntegrationBinding({ db: tauriDatabase, binding });

  try {
    await storeSecret();
  } catch (storeError) {
    try {
      await rollback({ workspaceId, projectId: scope, provider, existing, created });
    } finally {
      throw storeError;
    }
  }

  const usage = await countWorkspacesPerIntegrationCredential(tauriDatabase);
  set((state) => {
    const current = state.workspaceIntegrations[workspaceId] ?? [];
    const rest = current.filter(
      (candidate) => candidate.provider !== provider || candidate.projectId !== scope,
    );
    const credentials =
      created === null
        ? state.integrationCredentials
        : [...state.integrationCredentials.filter((held) => held.id !== created.id), created];
    return {
      workspaceIntegrations: {
        ...state.workspaceIntegrations,
        [workspaceId]: [...rest, binding],
      },
      integrationCredentials: credentials,
      integrationCredentialUsage: usage,
    };
  });
};
