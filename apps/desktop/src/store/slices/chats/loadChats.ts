import type { ChatId, ChatSessionLink, IsoDateTime } from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import type { GetFn, LoadChatsParams, SetFn } from './types';

export const loadChats =
  (set: SetFn, get: GetFn) =>
  async ({ workspaceId }: LoadChatsParams): Promise<void> => {
    if (!get().hasSettledChatStreams) {
      await activeChatBackend.settleStreaming({ now: new Date().toISOString() as IsoDateTime });
      set({ hasSettledChatStreams: true });
    }
    const [chats, links] = await Promise.all([
      activeChatBackend.listChats({ workspaceId }),
      activeChatBackend.listLinks({ workspaceId }),
    ]);
    const grouped: Record<string, ReadonlyArray<ChatSessionLink>> = {};
    for (const link of links) {
      grouped[link.chatId] = [...(grouped[link.chatId] ?? []), link];
    }
    set((state) => {
      const known = new Set<ChatId>(chats.map((chat) => chat.id));
      const kept = Object.fromEntries(
        Object.entries(state.chatLinks).filter(([chatId]) => !known.has(chatId as ChatId)),
      );
      return {
        chatsByWorkspace: { ...state.chatsByWorkspace, [workspaceId]: chats },
        chatLinks: { ...kept, ...grouped },
      };
    });
  };
