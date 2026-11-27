import type { QueuedChatTarget, SliceDeps } from './types';

export const retryQueuedChatMessage =
  ({ get }: SliceDeps) =>
  ({ chatId, itemId }: QueuedChatTarget): Promise<void> =>
    get().drainChatQueue({ chatId, itemId });
