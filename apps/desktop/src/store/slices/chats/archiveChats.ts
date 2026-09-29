import type { IsoDateTime } from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import type { ArchiveChatsParams, SetFn } from './types';
import { writeUnreadChats } from './unreadStorage';

export const archiveChats =
  (set: SetFn) =>
  async ({ workspaceId, chatIds }: ArchiveChatsParams): Promise<void> => {
    if (chatIds.length === 0) {
      return;
    }
    const now = new Date().toISOString() as IsoDateTime;
    await activeChatBackend.setArchived({ chatIds, archivedAt: now, now });
    set((state) => {
      const unreadChatIds = state.unreadChatIds.filter((id) => !chatIds.includes(id));
      if (unreadChatIds.length !== state.unreadChatIds.length) {
        writeUnreadChats({ chatIds: unreadChatIds });
      }
      const archived = state.archivedChatsByWorkspace[workspaceId];
      const moved = (state.chatsByWorkspace[workspaceId] ?? [])
        .filter((chat) => chatIds.includes(chat.id))
        .map((chat) => ({ ...chat, archivedAt: now, updatedAt: now }));
      return {
        ...(archived !== undefined && {
          archivedChatsByWorkspace: {
            ...state.archivedChatsByWorkspace,
            [workspaceId]: [...moved, ...archived],
          },
        }),
        chatsByWorkspace: {
          ...state.chatsByWorkspace,
          [workspaceId]: (state.chatsByWorkspace[workspaceId] ?? []).filter(
            (chat) => !chatIds.includes(chat.id),
          ),
        },
        unreadChatIds,
      };
    });
  };
