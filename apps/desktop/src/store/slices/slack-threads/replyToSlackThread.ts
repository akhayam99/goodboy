import { slackPostReply } from '../../../features/integrations/slack/client';
import { runSlackWrite } from './runSlackWrite';
import type { GetFn, SlackReplyParams } from './types';

export const replyToSlackThread = (get: GetFn) => {
  return async ({ workspaceId, channelId, threadTs, text }: SlackReplyParams): Promise<void> => {
    await runSlackWrite({
      get,
      workspaceId,
      channelId,
      threadTs,
      write: async () => {
        await slackPostReply({ workspaceId, channelId, threadTs, text });
      },
    });
  };
};
