import type { IntegrationCredentialId, WorkspaceId } from '@goodboy/types';
import {
  slackConnect,
  slackValidateConnection,
  type SlackConnection,
} from '../../../features/integrations/slack/client';
import { commitIntegrationConnection } from './commitIntegrationConnection';
import { configFromSlackConnection } from './configFromSlackConnection';
import type { SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly userToken: string | null;
  readonly credentialId: IntegrationCredentialId | null;
};

export const connectSlack = (set: SetFn) => {
  return async ({ workspaceId, userToken, credentialId }: Params): Promise<SlackConnection> => {
    const chosen = credentialId ?? (crypto.randomUUID() as IntegrationCredentialId);
    const supplied = credentialId === null ? userToken : null;
    const connection = await slackValidateConnection({ credentialId: chosen, userToken: supplied });
    await commitIntegrationConnection({
      set,
      workspaceId,
      provider: 'slack',
      credentialId: chosen,
      config: configFromSlackConnection({ connection }),
      newCredential:
        credentialId === null ? { label: connection.userName, account: connection.teamName } : null,
      storeSecret: () => slackConnect({ credentialId: chosen, userToken: supplied }),
    });
    return connection;
  };
};
