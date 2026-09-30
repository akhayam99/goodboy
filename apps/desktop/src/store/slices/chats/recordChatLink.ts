import type { ChatSessionLink, ChatSessionLinkId, IsoDateTime } from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import type { RecordChatLinkParams, SetFn } from './types';

export const recordChatLink =
  (set: SetFn) =>
  async ({
    chatId,
    sessionId,
    messageId,
    kind,
  }: RecordChatLinkParams): Promise<ChatSessionLink> => {
    const link: ChatSessionLink = {
      id: crypto.randomUUID() as ChatSessionLinkId,
      chatId,
      sessionId,
      messageId,
      kind,
      createdAt: new Date().toISOString() as IsoDateTime,
    };
    await activeChatBackend.insertLink({ link });
    set((state) => ({
      chatLinks: { ...state.chatLinks, [chatId]: [...(state.chatLinks[chatId] ?? []), link] },
    }));
    return link;
  };
