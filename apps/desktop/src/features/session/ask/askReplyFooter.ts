import type { ChatMessage } from '@goodboy/types';
import { chatAnswerMeta } from '../../workspace-chat/chatAnswerMeta';
import { pluralize } from '../../../shared/utils/pluralize';
import { formatAskCost } from './askRightNow';

type Params = {
  readonly message: ChatMessage;
  readonly costUsd: number | null;
};

export const askReplyFooter = ({ message, costUsd }: Params): string => {
  const seconds = Math.max(
    0,
    Math.round((Date.parse(message.updatedAt) - Date.parse(message.createdAt)) / 1000),
  );
  const parts = [
    chatAnswerMeta({ message }),
    message.status === 'streaming' ? null : `${seconds}s`,
    costUsd === null ? null : formatAskCost(costUsd),
    message.reads.length === 0 ? null : `read ${pluralize(message.reads.length, 'file')}`,
  ];
  return parts.filter((part): part is string => part !== null).join(' · ');
};
