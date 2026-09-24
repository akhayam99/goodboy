import {
  countWorkspacesPerIntegrationCredential,
  deleteIntegrationBindingsForProvider,
} from '@goodboy/db';
import type { WorkspaceId, WorkspaceIntegrationProvider } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { pruneSlackWorkspace } from '../slack-threads/state';
import type { SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly provider: WorkspaceIntegrationProvider;
};

export const disconnectIntegration = (set: SetFn) => {
  return async ({ workspaceId, provider }: Params): Promise<void> => {
    await deleteIntegrationBindingsForProvider({ db: tauriDatabase, workspaceId, provider });
    const integrationCredentialUsage = await countWorkspacesPerIntegrationCredential(tauriDatabase);
    set((state) => ({
      ...(provider === 'slack' && pruneSlackWorkspace({ state, workspaceId })),
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
