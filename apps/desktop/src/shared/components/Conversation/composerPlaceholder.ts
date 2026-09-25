import type { ConversationCapabilities } from './types';
import type { ReplyTarget } from './useReplyTarget';

type Params = {
  readonly capabilities: ConversationCapabilities;
  readonly target: ReplyTarget | null;
};

export const composerPlaceholder = ({ capabilities, target }: Params): string => {
  if (target != null) {
    return target.mode === 'thread' ? 'Write a reply' : 'Write a comment';
  }
  if (!capabilities.startThread) {
    return 'Reply in thread';
  }
  if (capabilities.reply === 'thread') {
    return 'Start a new thread';
  }
  return 'Write a comment';
};
