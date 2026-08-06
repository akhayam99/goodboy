import type { SlackIntegrationConfig } from '@goodboy/types';
import type { SlackConnection } from '../../../features/integrations/slack/client';

type Params = {
  readonly connection: SlackConnection;
};

export const configFromSlackConnection = ({ connection }: Params): SlackIntegrationConfig => ({
  teamId: connection.teamId,
  teamName: connection.teamName,
  botUserId: connection.botUserId,
  botUserName: connection.botUserName,
});
