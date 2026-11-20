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
    try {
      await activeChatBackend.cancelTurn({ runId: stream.runId });
    } catch (error) {
      set((state) => {
        const current = state.chatStreams[chatId];
        if (current === undefined || current.runId !== stream.runId) {
          return {};
        }
        return {
          chatStreams: { ...state.chatStreams, [chatId]: { ...current, isStopping: false } },
        };
      });
      throw error;
    }
  };
