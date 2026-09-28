import type { IsoDateTime } from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import type { GetFn, LoadChatsParams, SetFn } from './types';

export const loadChats =
  (set: SetFn, get: GetFn) =>
  async ({ workspaceId }: LoadChatsParams): Promise<void> => {
    if (!get().hasSettledChatStreams) {
      await activeChatBackend.settleStreaming({ now: new Date().toISOString() as IsoDateTime });
      set({ hasSettledChatStreams: true });
    }
    const chats = await activeChatBackend.listChats({ workspaceId });
    set((state) => ({ chatsByWorkspace: { ...state.chatsByWorkspace, [workspaceId]: chats } }));
  };
