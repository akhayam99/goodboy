import { useCallback, useEffect, useRef, useState } from 'react';
import type { PendingAttachment, QueuedTurn } from '../lib';

interface UseMessageQueueArgs {
  readonly isRunning: boolean;
  readonly dispatchTurn: (
    content: string,
    atts: ReadonlyArray<PendingAttachment>,
    override: QueuedTurn['override'],
  ) => Promise<void>;
  readonly onEdit: (item: QueuedTurn) => void;
}

export function useMessageQueue({ isRunning, dispatchTurn, onEdit }: UseMessageQueueArgs) {
  const [queue, setQueue] = useState<ReadonlyArray<QueuedTurn>>([]);
  const wasRunning = useRef(isRunning);

  useEffect(() => {
    const wasRun = wasRunning.current;
    wasRunning.current = isRunning;
    if (wasRun && !isRunning && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      if (next) {
        void dispatchTurn(next.content, next.attachments, next.override);
      }
    }
  }, [isRunning, queue, dispatchTurn]);

  const enqueue = useCallback((turn: QueuedTurn) => {
    setQueue((prev) => [...prev, turn]);
  }, []);

  const removeQueued = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const editQueued = useCallback(
    (id: string) => {
      const item = queue.find((q) => q.id === id);
      if (!item) {
        return;
      }
      setQueue((prev) => prev.filter((q) => q.id !== id));
      onEdit(item);
    },
    [queue, onEdit],
  );

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return { queue, enqueue, removeQueued, editQueued, clearQueue };
}
