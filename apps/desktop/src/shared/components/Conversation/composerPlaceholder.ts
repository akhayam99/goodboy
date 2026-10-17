import type { ConversationCapabilities } from './types';
import type { ReplyTarget } from './useReplyTarget';

type Params = {
  readonly capabilities: ConversationCapabilities;
  readonly target: ReplyTarget | null;
  readonly toolLabel: string;
};

const ISSUES_SUFFIX = ' issues';

type HostParams = {
  readonly toolLabel: string;
};

const hostOf = ({ toolLabel }: HostParams): string =>
  toolLabel.endsWith(ISSUES_SUFFIX) ? toolLabel.slice(0, -ISSUES_SUFFIX.length) : toolLabel;

export const composerPlaceholder = ({ capabilities, target, toolLabel }: Params): string => {
  if (target != null) {
    return target.mode === 'thread' ? 'Write a reply' : 'Write a comment';
  }
  if (!capabilities.startThread) {
    return 'Reply in thread';
  }
  return `Reply on ${hostOf({ toolLabel })}`;
};
