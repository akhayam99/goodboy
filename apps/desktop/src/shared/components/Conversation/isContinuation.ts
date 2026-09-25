import type { ConversationMessage } from './types';

const CONTINUATION_WINDOW_MS = 5 * 60_000;

type Params = {
  readonly previous: ConversationMessage | null;
  readonly message: ConversationMessage;
};

export const isContinuation = ({ previous, message }: Params): boolean => {
  if (previous == null) {
    return false;
  }
  if (previous.author.name !== message.author.name) {
    return false;
  }
  if (previous.status !== 'sent' || message.status !== 'sent') {
    return false;
  }
  const gap = Date.parse(message.createdAt) - Date.parse(previous.createdAt);
  if (Number.isNaN(gap)) {
    return false;
  }
  return gap >= 0 && gap <= CONTINUATION_WINDOW_MS;
};
