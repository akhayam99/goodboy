import { CHAT_PROVIDER_REFUSAL, isChatProvider, type IsoDateTime } from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import { patchChatSummary } from './patchChatSummary';
import type { SetChatModelParams, SetFn } from './types';

export const setChatModel =
  (set: SetFn) =>
  async ({ chatId, provider, model }: SetChatModelParams): Promise<void> => {
    if (!isChatProvider(provider)) {
      throw new Error(CHAT_PROVIDER_REFUSAL);
    }
    const now = new Date().toISOString() as IsoDateTime;
    await activeChatBackend.setModel({ chatId, provider, model, now });
    set((state) => patchChatSummary({ state, chatId, patch: { provider, model, updatedAt: now } }));
  };
