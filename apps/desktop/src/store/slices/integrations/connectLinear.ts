import { upsertWorkspaceIntegration } from '@goodboy/db';
import type {
  IsoDateTime,
  LinearWorkspaceIntegration,
  WorkspaceId,
  WorkspaceIntegrationId,
} from '@goodboy/types';
import { linearConnect, type LinearViewer } from '../../../features/integrations/linear/client';
import { tauriDatabase } from '../../../shared/lib/db';
import { configFromLinearViewer } from './configFromLinearViewer';
import type { GetFn, SetFn } from './types';

export const connectLinear = (set: SetFn, get: GetFn) => {
  return async (workspaceId: WorkspaceId, token: string): Promise<LinearViewer> => {
    const viewer = await linearConnect(workspaceId, token);
    const now = new Date().toISOString() as IsoDateTime;
    const existing = get().workspaceIntegrations[workspaceId]?.find(
      (i): i is LinearWorkspaceIntegration => i.provider === 'linear',
    );
    const integration: LinearWorkspaceIntegration = {
      id: (existing?.id ?? crypto.randomUUID()) as WorkspaceIntegrationId,
      workspaceId,
      provider: 'linear',
      config: { ...(existing?.config ?? {}), ...configFromLinearViewer(viewer) },
      credentialKey: `goodboy.workspace.${workspaceId}.linear`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertWorkspaceIntegration(tauriDatabase, integration);
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? [];
      const rest = current.filter((i) => i.provider !== 'linear');
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: [...rest, integration],
        },
      };
    });
    return viewer;
  };
};
