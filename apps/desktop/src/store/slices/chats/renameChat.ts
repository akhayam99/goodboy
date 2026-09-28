import type { IsoDateTime } from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import { patchChatSummary } from './patchChatSummary';
import type { RenameChatParams, SetFn } from './types';

export const renameChat =
  (set: SetFn) =>
  async ({ chatId, title }: RenameChatParams): Promise<void> => {
    const trimmed = title.trim();
    if (trimmed === '') {
      return;
    }
    const now = new Date().toISOString() as IsoDateTime;
    await activeChatBackend.rename({ chatId, title: trimmed, now });
    set((state) => patchChatSummary({ state, chatId, patch: { title: trimmed, updatedAt: now } }));
  };
