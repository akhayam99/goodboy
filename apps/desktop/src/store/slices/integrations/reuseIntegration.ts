import { upsertWorkspaceIntegration } from '@goodboy/db';
import type {
  IsoDateTime,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationId,
  WorkspaceIntegrationProvider,
} from '@goodboy/types';
import { reuseIntegrationCredential } from '../../../features/integrations/credentialReuse';
import { resolveReusableIntegration } from '../../../features/integrations/resolveReusableIntegration';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly provider: WorkspaceIntegrationProvider;
  readonly workspaceId: WorkspaceId;
};

export const reuseIntegration = (set: SetFn, get: GetFn) => {
  return async ({ provider, workspaceId }: Params): Promise<void> => {
    const source = resolveReusableIntegration({
      provider,
      workspaceId,
      workspaceIntegrations: get().workspaceIntegrations,
    });
    if (source === null) {
      throw new Error(`no saved ${provider} configuration to reuse`);
    }
    await reuseIntegrationCredential({
      provider,
      fromWorkspaceId: source.workspaceId,
      toWorkspaceId: workspaceId,
    });
    const now = new Date().toISOString() as IsoDateTime;
    const integration: WorkspaceIntegration = {
      ...source,
      id: crypto.randomUUID() as WorkspaceIntegrationId,
      workspaceId,
      credentialKey: `goodboy.workspace.${workspaceId}.${provider}`,
      createdAt: now,
      updatedAt: now,
    };
    await upsertWorkspaceIntegration(tauriDatabase, integration);
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? [];
      const rest = current.filter((candidate) => candidate.provider !== provider);
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: [...rest, integration],
        },
      };
    });
  };
};
