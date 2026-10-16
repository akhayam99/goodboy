import type { ChatMessage } from '@goodboy/types';
import { chatAnswerMeta } from '../../workspace-chat/chatAnswerMeta';
import { formatDuration } from '../../../shared/utils/time/formatDuration';
import { joinFacts } from '../../../shared/utils/joinFacts';

type Params = {
  readonly message: ChatMessage;
};

export const askReplyFooter = ({ message }: Params): string => {
  const durationMs = Math.max(0, Date.parse(message.updatedAt) - Date.parse(message.createdAt));
  return joinFacts({
    facts: [
      chatAnswerMeta({ message }),
      message.status === 'streaming' ? null : formatDuration({ durationMs }),
    ],
  });
};
