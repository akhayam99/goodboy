import {
  deleteWorkspaceIntegration,
  getWorkspaceIntegration,
  upsertWorkspaceIntegration,
} from '@goodboy/db';
import type {
  IsoDateTime,
  SlackWorkspaceIntegration,
  WorkspaceId,
  WorkspaceIntegrationId,
} from '@goodboy/types';
import {
  slackConnect as slackStoreToken,
  slackValidateConnection,
  type SlackConnection,
} from '../../../features/integrations/slack/client';
import { tauriDatabase } from '../../../shared/lib/db';
import { configFromSlackConnection } from './configFromSlackConnection';
import type { GetFn, SetFn } from './types';

type ConnectParams = {
  readonly workspaceId: WorkspaceId;
  readonly botToken: string;
};

type RollbackParams = {
  readonly workspaceId: WorkspaceId;
  readonly existing: SlackWorkspaceIntegration | undefined;
};

const rollbackSlackRow = async ({ workspaceId, existing }: RollbackParams): Promise<void> => {
  if (existing !== undefined) {
    await upsertWorkspaceIntegration(tauriDatabase, existing);
    return;
  }
  await deleteWorkspaceIntegration(tauriDatabase, workspaceId, 'slack');
};

export const connectSlack = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, botToken }: ConnectParams): Promise<SlackConnection> => {
    const connection = await slackValidateConnection({ botToken });
    const now = new Date().toISOString() as IsoDateTime;
    const existingIntegration = await getWorkspaceIntegration(tauriDatabase, workspaceId, 'slack');
    const existing = existingIntegration?.provider === 'slack' ? existingIntegration : undefined;
    const integration: SlackWorkspaceIntegration = {
      id: (existing?.id ?? crypto.randomUUID()) as WorkspaceIntegrationId,
      workspaceId,
      provider: 'slack',
      config: configFromSlackConnection({ connection }),
      credentialKey: `goodboy.workspace.${workspaceId}.slack`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertWorkspaceIntegration(tauriDatabase, integration);
    try {
      await slackStoreToken({ workspaceId, botToken });
    } catch (storeError) {
      try {
        await rollbackSlackRow({ workspaceId, existing });
      } finally {
        throw storeError;
      }
    }
    set((state) => {
      const current = state.workspaceIntegrations[workspaceId] ?? [];
      const rest = current.filter((candidate) => candidate.provider !== 'slack');
      return {
        workspaceIntegrations: {
          ...state.workspaceIntegrations,
          [workspaceId]: [...rest, integration],
        },
      };
    });
    return connection;
  };
};
