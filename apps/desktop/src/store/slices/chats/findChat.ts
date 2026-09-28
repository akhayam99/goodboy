import type { ChatId, ChatSummary } from '@goodboy/types';
import type { ChatsState } from './state';

type Params = {
  readonly state: ChatsState;
  readonly chatId: ChatId;
};

export const findChat = ({ state, chatId }: Params): ChatSummary | null => {
  for (const chats of Object.values(state.chatsByWorkspace)) {
    const chat = chats.find((candidate) => candidate.id === chatId);
    if (chat !== undefined) {
      return chat;
    }
  }
  return null;
};
