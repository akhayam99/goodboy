import type { ChatId, ChatMessageId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';

export type AskLineReplyId = Readonly<{
  threadId: ChatId;
  messageId: ChatMessageId;
}>;

type Params = Readonly<{
  state: Pick<AppStore, 'askThreads' | 'askStreams' | 'askMessages'>;
  sessionId: SessionId;
  question: string;
}>;

export const askLineReplyIdOf = ({ state, sessionId, question }: Params): AskLineReplyId | null => {
  const asked = question.trim();
  for (const thread of state.askThreads[sessionId] ?? []) {
    const stream = state.askStreams[thread.id];
    if (stream === undefined) {
      continue;
    }
    const messages = state.askMessages[thread.id] ?? [];
    const index = messages.findIndex((message) => message.id === stream.messageId);
    const before = index > 0 ? messages[index - 1] : undefined;
    if (before !== undefined && before.role === 'user' && before.content === asked) {
      return { threadId: thread.id, messageId: stream.messageId };
    }
  }
  return null;
};
