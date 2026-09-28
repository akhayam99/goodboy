import type { IsoDateTime } from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import type { GetFn, LoadChatsParams, SetFn } from './types';

export const loadChats =
  (set: SetFn, get: GetFn) =>
  async ({ workspaceId }: LoadChatsParams): Promise<void> => {
    if (!get().hasSettledChatStreams) {
      set({ hasSettledChatStreams: true });
      await activeChatBackend.settleStreaming({ now: new Date().toISOString() as IsoDateTime });
    }
    const chats = await activeChatBackend.listChats({ workspaceId });
    set((state) => ({ chatsByWorkspace: { ...state.chatsByWorkspace, [workspaceId]: chats } }));
  };
