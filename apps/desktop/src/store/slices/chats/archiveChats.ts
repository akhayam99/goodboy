import type { IsoDateTime } from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import type { ArchiveChatsParams, SetFn } from './types';

export const archiveChats =
  (set: SetFn) =>
  async ({ workspaceId, chatIds }: ArchiveChatsParams): Promise<void> => {
    if (chatIds.length === 0) {
      return;
    }
    const now = new Date().toISOString() as IsoDateTime;
    await activeChatBackend.setArchived({ chatIds, archivedAt: now, now });
    set((state) => ({
      chatsByWorkspace: {
        ...state.chatsByWorkspace,
        [workspaceId]: (state.chatsByWorkspace[workspaceId] ?? []).filter(
          (chat) => !chatIds.includes(chat.id),
        ),
      },
    }));
  };
