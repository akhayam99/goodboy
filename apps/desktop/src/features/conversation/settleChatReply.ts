import type { ChatMessage, ChatMessageStatus, IsoDateTime } from '@goodboy/types';
import type { ChatTurnOutcome } from './chatTurnOutcome';

type Params = {
  readonly reply: ChatMessage;
  readonly isStopping: boolean;
  readonly outcome: ChatTurnOutcome;
  readonly at: IsoDateTime;
};

export const settleChatReply = ({ reply, isStopping, outcome, at }: Params): ChatMessage => {
  const status: ChatMessageStatus = isStopping
    ? 'stopped'
    : outcome.status === 'done'
      ? 'done'
      : 'failed';
  return {
    ...reply,
    status,
    error: status === 'failed' && outcome.status === 'failed' ? outcome.error : null,
    updatedAt: at,
  };
};
