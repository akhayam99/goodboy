import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';
import {
  slackConnect,
  slackValidateConnection,
  type SlackConnection,
} from '../../../features/integrations/slack/client';
import { commitIntegrationConnection } from './commitIntegrationConnection';
import { configFromSlackConnection } from './configFromSlackConnection';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly botToken: string | null;
  readonly credentialId: IntegrationCredentialId | null;
};

export const connectSlack = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, botToken, credentialId }: Params): Promise<SlackConnection> => {
    const chosen = credentialId ?? (crypto.randomUUID() as IntegrationCredentialId);
    const supplied = credentialId === null ? botToken : null;
    const connection = await slackValidateConnection({ credentialId: chosen, botToken: supplied });
    await commitIntegrationConnection({
      set,
      get,
      workspaceId,
      provider: 'slack',
      credentialId: chosen,
      config: configFromSlackConnection({ connection }),
      newCredential:
        credentialId === null
          ? { label: connection.botUserName ?? connection.teamName, account: connection.teamName }
          : null,
      storeSecret: () => slackConnect({ credentialId: chosen, botToken: supplied }),
    });
    return connection;
  };
};
