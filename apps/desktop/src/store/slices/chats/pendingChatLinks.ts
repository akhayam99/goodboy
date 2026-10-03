import type { PendingChatLink } from './state';
import type { GetFn, PendingChatLinkParams, SessionChatLinksParams, SetFn } from './types';

export const queueChatLink =
  (set: SetFn) =>
  ({ chatId, sessionId, messageId }: PendingChatLinkParams): void => {
    set((state) => {
      const queued = state.pendingChatLinks[sessionId] ?? [];
      if (queued.some((pending) => pending.chatId === chatId)) {
        return state;
      }
      return {
        pendingChatLinks: {
          ...state.pendingChatLinks,
          [sessionId]: [...queued, { chatId, messageId }],
        },
      };
    });
  };

export const flushChatLinks =
  (set: SetFn, get: GetFn) =>
  async ({ sessionId }: SessionChatLinksParams): Promise<void> => {
    const queued = get().pendingChatLinks[sessionId] ?? [];
    if (queued.length === 0) {
      return;
    }
    set((state) => {
      const pendingChatLinks = { ...state.pendingChatLinks };
      delete pendingChatLinks[sessionId];
      return { pendingChatLinks };
    });
    const failed: Array<PendingChatLink> = [];
    for (const pending of queued) {
      try {
        await get().recordChatLink({
          chatId: pending.chatId,
          sessionId,
          messageId: pending.messageId,
          kind: 'add',
        });
      } catch {
        failed.push(pending);
      }
    }
    if (failed.length === 0) {
      return;
    }
    set((state) => ({
      pendingChatLinks: {
        ...state.pendingChatLinks,
        [sessionId]: [...(state.pendingChatLinks[sessionId] ?? []), ...failed],
      },
    }));
  };
