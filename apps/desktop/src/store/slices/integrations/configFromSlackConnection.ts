import type { SlackIntegrationConfig } from '@goodboy/types';
import type { SlackConnection } from '../../../features/integrations/slack/client';

type Params = {
  readonly connection: SlackConnection;
};

export const configFromSlackConnection = ({ connection }: Params): SlackIntegrationConfig => ({
  teamId: connection.teamId,
  teamName: connection.teamName,
  userId: connection.userId,
  userName: connection.userName,
  followedChannels: [],
  hasSelectedChannels: true,
  includePrivate: false,
  agentPolicy: {
    readFollowed: 'allow',
    readOthers: 'off',
    reply: 'ask',
    react: 'allow',
  },
  signature: {
    agents: true,
    own: false,
    text: 'Written with Goodboy',
  },
});
