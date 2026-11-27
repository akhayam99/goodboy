import { drainsInFlight } from './drainsInFlight';
import { withoutQueuedTurn } from './queueEdits';
import type { QueuedChatTarget, QueuedChatTurn, SliceDeps } from './types';

export const takeQueuedChatMessage =
  ({ set, get }: SliceDeps) =>
  ({ chatId, itemId }: QueuedChatTarget): QueuedChatTurn | null => {
    const queue = get().chatQueues[chatId] ?? [];
    const turn = queue.find((candidate) => candidate.id === itemId);
    if (turn === undefined || (drainsInFlight.has(chatId) && queue[0]?.id === itemId)) {
      return null;
    }
    set((state) => withoutQueuedTurn({ state, chatId, itemId }));
    return turn;
  };
