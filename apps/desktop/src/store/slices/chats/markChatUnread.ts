import type { ChatParams, SetFn } from './types';
import { writeUnreadChats } from './unreadStorage';

export const markChatUnread =
  (set: SetFn) =>
  ({ chatId }: ChatParams): void =>
    set((state) => {
      if (state.unreadChatIds.includes(chatId)) {
        return {};
      }
      const unreadChatIds = [...state.unreadChatIds, chatId];
      writeUnreadChats({ chatIds: unreadChatIds });
      return { unreadChatIds };
    });
