import type { ChatId, ChatMessage, ChatMessageId } from '@goodboy/types';
import type { ChatsState } from './state';

type Params = {
  readonly state: ChatsState;
  readonly chatId: ChatId;
  readonly messageId: ChatMessageId;
  readonly update: (message: ChatMessage) => ChatMessage;
};

export const patchChatMessage = ({
  state,
  chatId,
  messageId,
  update,
}: Params): Pick<ChatsState, 'chatMessages'> => ({
  chatMessages: {
    ...state.chatMessages,
    [chatId]: (state.chatMessages[chatId] ?? []).map((message) =>
      message.id === messageId ? update(message) : message,
    ),
  },
});
