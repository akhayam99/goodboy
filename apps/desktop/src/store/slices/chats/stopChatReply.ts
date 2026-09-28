import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import type { ChatParams, GetFn, SetFn } from './types';

export const stopChatReply =
  (set: SetFn, get: GetFn) =>
  async ({ chatId }: ChatParams): Promise<void> => {
    const stream = get().chatStreams[chatId];
    if (stream === undefined || stream.isStopping) {
      return;
    }
    set((state) => ({
      chatStreams: { ...state.chatStreams, [chatId]: { ...stream, isStopping: true } },
    }));
    await activeChatBackend.cancelTurn({ runId: stream.runId });
  };
