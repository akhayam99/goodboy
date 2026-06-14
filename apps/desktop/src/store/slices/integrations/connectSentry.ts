import { upsertWorkspaceIntegration } from '@goodboy/db';
import type {
  IsoDateTime,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceIntegrationId,
} from '@goodboy/types';
import { sentryConnect, type SentryProject } from '../../../features/integrations/sentry/client';
import { tauriDatabase } from '../../../shared/lib/db';
import { configFromSentry } from './configFromSentry';
import type { GetFn, SetFn } from './types';

export const connectSentry = (set: SetFn, get: GetFn) => {
  return async (
    workspaceId: WorkspaceId,
    token: string,
    org: string,
    project: string,
  ): Promise<SentryProject> => {
    const projectInfo = await sentryConnect(workspaceId, token, org, project);
    const now = new Date().toISOString() as IsoDateTime;
    const existing = get().workspaceIntegrations[workspaceId]?.find((i) => i.provider === 'sentry');
    const integration: WorkspaceIntegration = {
      id: (existing?.id ?? crypto.randomUUID()) as WorkspaceIntegrationId,
      workspaceId,
      provider: 'sentry',
      config: configFromSentry(projectInfo),
      credentialKey: `goodboy.workspace.${workspaceId}.sentry`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertWorkspaceIntegration(tauriDatabase, integration);
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? [];
      const rest = current.filter((i) => i.provider !== 'sentry');
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: [...rest, integration],
        },
      };
    });
    return projectInfo;
  };
};
