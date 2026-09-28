import type { IsoDateTime } from '@goodboy/types';
import { activeChatBackend } from '../../../features/workspace-chat/activeChatBackend';
import { patchChatSummary } from './patchChatSummary';
import type { PinChatParams, SetFn } from './types';

export const pinChat =
  (set: SetFn) =>
  async ({ chatId, isPinned }: PinChatParams): Promise<void> => {
    const now = new Date().toISOString() as IsoDateTime;
    const pinnedAt = isPinned ? now : null;
    await activeChatBackend.setPinned({ chatId, pinnedAt, now });
    set((state) => patchChatSummary({ state, chatId, patch: { pinnedAt, updatedAt: now } }));
  };
