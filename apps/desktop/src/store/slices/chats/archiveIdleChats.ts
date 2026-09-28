import type { ChatId } from '@goodboy/types';
import { selectChatGroups } from './selectChatGroups';
import type { ArchiveIdleChatsParams, GetFn } from './types';

export const archiveIdleChats =
  (get: GetFn) =>
  async ({ workspaceId }: ArchiveIdleChatsParams): Promise<ReadonlyArray<ChatId>> => {
    const { idle } = selectChatGroups({
      chats: get().chatsByWorkspace[workspaceId] ?? [],
      now: Date.now(),
    });
    const chatIds = idle.map((chat) => chat.id);
    await get().archiveChats({ workspaceId, chatIds });
    return chatIds;
  };
