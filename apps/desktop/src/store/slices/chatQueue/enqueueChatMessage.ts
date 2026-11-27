import { appendQueuedTurn } from './queueEdits';
import type { QueueChatMessageParams, SliceDeps } from './types';

export const enqueueChatMessage =
  ({ set }: SliceDeps) =>
  ({ chatId, content, attachments }: QueueChatMessageParams): boolean => {
    const text = content.trim();
    if (text === '' && attachments.length === 0) {
      return false;
    }
    set((state) =>
      appendQueuedTurn({
        state,
        chatId,
        turn: {
          id: crypto.randomUUID(),
          content: text,
          attachments,
          status: 'queued',
          failure: null,
        },
      }),
    );
    return true;
  };
