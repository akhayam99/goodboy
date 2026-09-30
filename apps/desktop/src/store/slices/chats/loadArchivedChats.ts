import type { ChatSummary } from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import type { LoadChatsParams, SetFn } from './types';

export const loadArchivedChats =
  (set: SetFn) =>
  async ({ workspaceId }: LoadChatsParams): Promise<ReadonlyArray<ChatSummary>> => {
    const all = await activeChatBackend.listChats({ workspaceId, includeArchived: true });
    const archived = all.filter((chat) => chat.archivedAt !== null);
    set((state) => ({
      archivedChatsByWorkspace: { ...state.archivedChatsByWorkspace, [workspaceId]: archived },
    }));
    return archived;
  };
