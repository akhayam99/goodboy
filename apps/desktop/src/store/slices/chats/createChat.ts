import {
  CHAT_PROVIDER_REFUSAL,
  isChatProvider,
  type Chat,
  type ChatId,
  type IsoDateTime,
} from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import { NEW_CHAT_TITLE } from './chatTitleFromQuestion';
import type { CreateChatParams, SetFn } from './types';

export const createChat =
  (set: SetFn) =>
  async ({ workspaceId, provider, model, title }: CreateChatParams): Promise<ChatId> => {
    if (!isChatProvider(provider)) {
      throw new Error(CHAT_PROVIDER_REFUSAL);
    }
    const now = new Date().toISOString() as IsoDateTime;
    const trimmed = title?.trim() ?? '';
    const chat: Chat = {
      id: crypto.randomUUID() as ChatId,
      workspaceId,
      title: trimmed === '' ? NEW_CHAT_TITLE : trimmed,
      provider,
      model,
      effort: null,
      pinnedAt: null,
      archivedAt: null,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await activeChatBackend.insertChat({ chat });
    set((state) => ({
      chatsByWorkspace: {
        ...state.chatsByWorkspace,
        [workspaceId]: [
          { ...chat, preview: null, modelsUsed: [] },
          ...(state.chatsByWorkspace[workspaceId] ?? []),
        ],
      },
      chatMessages: { ...state.chatMessages, [chat.id]: [] },
    }));
    return chat.id;
  };
