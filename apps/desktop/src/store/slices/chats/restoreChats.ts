import type { IsoDateTime } from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import type { ArchiveChatsParams, SetFn } from './types';

export const restoreChats =
  (set: SetFn) =>
  async ({ workspaceId, chatIds }: ArchiveChatsParams): Promise<void> => {
    if (chatIds.length === 0) {
      return;
    }
    await activeChatBackend.setArchived({
      chatIds,
      archivedAt: null,
      now: new Date().toISOString() as IsoDateTime,
    });
    const chats = await activeChatBackend.listChats({ workspaceId });
    set((state) => ({ chatsByWorkspace: { ...state.chatsByWorkspace, [workspaceId]: chats } }));
  };
