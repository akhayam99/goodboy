import { countWorkspacesPerIntegrationCredential, deleteWorkspaceIntegration } from '@goodboy/db';
import type { WorkspaceId, WorkspaceIntegrationProvider } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly provider: WorkspaceIntegrationProvider;
};

export const disconnectIntegration = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, provider }: Params): Promise<void> => {
    const projects = get().projects.filter((project) => project.workspaceId === workspaceId);
    await Promise.all(
      projects.map((project) => deleteWorkspaceIntegration(tauriDatabase, project.id, provider)),
    );
    const integrationCredentialUsage = await countWorkspacesPerIntegrationCredential(tauriDatabase);
    set((state) => ({
      workspaceIntegrations: {
        ...state.workspaceIntegrations,
        [workspaceId]: (state.workspaceIntegrations[workspaceId] ?? []).filter(
          (integration) => integration.provider !== provider,
        ),
      },
      integrationCredentialUsage,
    }));
  };
};
