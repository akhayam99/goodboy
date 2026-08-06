import { slackAddReaction as slackAddReactionCall } from '../../../features/integrations/slack/client';
import { runSlackWrite } from './runSlackWrite';
import type { GetFn, SlackReactionParams } from './types';

export const addSlackReaction = (get: GetFn) => {
  return async ({
    workspaceId,
    channelId,
    threadTs,
    messageTs,
    name,
  }: SlackReactionParams): Promise<void> => {
    await runSlackWrite({
      get,
      workspaceId,
      channelId,
      threadTs,
      write: async () => {
        await slackAddReactionCall({ workspaceId, channelId, messageTs, name });
      },
    });
  };
};
