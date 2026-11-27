import { drainsInFlight } from './drainsInFlight';
import { withoutQueuedTurn } from './queueEdits';
import type { QueuedChatTarget, SliceDeps } from './types';

export const removeQueuedChatMessage =
  ({ set }: SliceDeps) =>
  ({ chatId, itemId }: QueuedChatTarget): void => {
    set((state) => {
      const [head] = state.chatQueues[chatId] ?? [];
      if (drainsInFlight.has(chatId) && head?.id === itemId) {
        return {};
      }
      return withoutQueuedTurn({ state, chatId, itemId });
    });
  };
