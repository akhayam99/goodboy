import { useCallback, useMemo } from 'react';
import type { ChatId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { QueuedChatTurn } from '../../../../store/slices/chatQueue/types';
import { queuedChatRowsOf } from '../../queuedChatRowsOf';

type Params = {
  readonly chatId: ChatId | null;
  readonly isStreaming: boolean;
  readonly onEdit: (turn: QueuedChatTurn) => void;
};

const EMPTY: ReadonlyArray<QueuedChatTurn> = [];

export const useChatQueue = ({ chatId, isStreaming, onEdit }: Params) => {
  const queue = useAppStore((state) =>
    chatId === null ? EMPTY : (state.chatQueues[chatId] ?? EMPTY),
  );
  const takeQueuedChatMessage = useAppStore((state) => state.takeQueuedChatMessage);
  const removeQueuedChatMessage = useAppStore((state) => state.removeQueuedChatMessage);
  const retryQueuedChatMessage = useAppStore((state) => state.retryQueuedChatMessage);
  const drainChatQueue = useAppStore((state) => state.drainChatQueue);

  const rows = useMemo(() => queuedChatRowsOf({ queue, isStreaming }), [queue, isStreaming]);
  const failed = queue.find((turn) => turn.status === 'failed' && turn.failure !== null);

  const onEditQueued = useCallback(
    (itemId: string) => {
      if (chatId === null) {
        return;
      }
      const turn = takeQueuedChatMessage({ chatId, itemId });
      if (turn !== null) {
        onEdit(turn);
      }
    },
    [chatId, takeQueuedChatMessage, onEdit],
  );

  const onRemove = useCallback(
    (itemId: string) => {
      if (chatId !== null) {
        removeQueuedChatMessage({ chatId, itemId });
      }
    },
    [chatId, removeQueuedChatMessage],
  );

  const onRetry = useCallback(
    (itemId: string) => {
      if (chatId !== null) {
        void retryQueuedChatMessage({ chatId, itemId });
      }
    },
    [chatId, retryQueuedChatMessage],
  );

  const onSendNow = useCallback(() => {
    if (chatId !== null) {
      void drainChatQueue({ chatId });
    }
  }, [chatId, drainChatQueue]);

  return {
    rows,
    failure:
      failed === undefined || failed.failure === null
        ? null
        : { title: "Couldn't send the queued message", message: failed.failure },
    onEdit: onEditQueued,
    onRemove,
    onRetry,
    onSendNow,
  };
};
