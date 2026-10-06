import type { ChatMessage } from '@goodboy/types';

export type AskTurnPair = {
  readonly question: ChatMessage;
  readonly reply: ChatMessage | null;
};

type Params = {
  readonly messages: ReadonlyArray<ChatMessage>;
};

export const askTurnsOf = ({ messages }: Params): ReadonlyArray<AskTurnPair> =>
  messages.flatMap((message, index) => {
    if (message.role !== 'user') {
      return [];
    }
    const next = messages[index + 1];
    return [{ question: message, reply: next?.role === 'assistant' ? next : null }];
  });
