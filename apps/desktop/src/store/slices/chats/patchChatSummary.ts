import type { ChatId, ChatSummary } from '@goodboy/types';
import type { ChatsState } from './state';

type Params = {
  readonly state: ChatsState;
  readonly chatId: ChatId;
  readonly patch: Partial<ChatSummary>;
};

export const patchChatSummary = ({
  state,
  chatId,
  patch,
}: Params): Pick<ChatsState, 'chatsByWorkspace'> => {
  const next: Record<string, ReadonlyArray<ChatSummary>> = {};
  for (const [workspaceId, chats] of Object.entries(state.chatsByWorkspace)) {
    next[workspaceId] = chats.some((chat) => chat.id === chatId)
      ? chats.map((chat) => (chat.id === chatId ? { ...chat, ...patch } : chat))
      : chats;
  }
  return { chatsByWorkspace: next };
};
