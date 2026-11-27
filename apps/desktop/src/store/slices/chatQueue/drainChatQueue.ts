import { formatError } from '@goodboy/ui';
import { drainsInFlight } from './drainsInFlight';
import { failQueuedTurn, queueOf } from './queueEdits';
import type { DrainChatQueueParams, SliceDeps } from './types';

const NOT_DELIVERED = 'The message was not delivered. It is still in the queue.';

export const drainChatQueue =
  ({ set, get }: SliceDeps) =>
  async ({ chatId, itemId }: DrainChatQueueParams): Promise<void> => {
    const head = queueOf({ state: get(), chatId })[0];
    if (
      head === undefined ||
      drainsInFlight.has(chatId) ||
      get().chatStreams[chatId] !== undefined
    ) {
      return;
    }
    const wantedStatus = itemId === undefined ? 'queued' : 'failed';
    if (head.status !== wantedStatus || (itemId !== undefined && head.id !== itemId)) {
      return;
    }
    const token = Symbol('drain');
    const release = (): void => {
      if (drainsInFlight.get(chatId) === token) {
        drainsInFlight.delete(chatId);
      }
    };
    drainsInFlight.set(chatId, token);
    let failure: string | null = null;
    try {
      const isStarted = await get().sendChatMessage({
        chatId,
        content: head.content,
        attachments: head.attachments,
        queuedId: head.id,
        onAccepted: release,
      });
      if (!isStarted && get().chatStreams[chatId] === undefined) {
        failure = NOT_DELIVERED;
      }
    } catch (error) {
      failure = formatError(error);
    } finally {
      release();
    }
    if (failure === null) {
      return;
    }
    const reason = failure;
    set((state) => failQueuedTurn({ state, chatId, itemId: head.id, failure: reason }));
  };
