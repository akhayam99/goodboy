import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import type { ChatParams, GetFn, SetFn } from './types';

export const loadChatMessages =
  (set: SetFn, get: GetFn) =>
  async ({ chatId }: ChatParams): Promise<void> => {
    const messages = await activeChatBackend.listMessages({ chatId });
    if (get().chatStreams[chatId] !== undefined) {
      return;
    }
    set((state) => ({ chatMessages: { ...state.chatMessages, [chatId]: messages } }));
  };
