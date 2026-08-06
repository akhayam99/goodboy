import { useCallback, useEffect, useRef } from 'react';
import type { AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { QueuedTurn } from '../lib';
import type { SendTurnResult } from '../../../../../store/slices/turn/types';
import type { DispatchTurnParams } from './useTurnDispatch';

type UseMessageQueueArgs = {
  readonly agentId: AgentId | null;
  readonly isRunning: boolean;
  readonly dispatchTurn: (params: DispatchTurnParams) => Promise<SendTurnResult>;
  readonly onEdit: (item: QueuedTurn) => void;
};

const EMPTY: ReadonlyArray<QueuedTurn> = [];

export function useMessageQueue({ agentId, isRunning, dispatchTurn, onEdit }: UseMessageQueueArgs) {
  const queue = useAppStore((s) =>
    agentId ? ((s.agentQueue[agentId] as ReadonlyArray<QueuedTurn> | undefined) ?? EMPTY) : EMPTY,
  );
  const setAgentQueue = useAppStore((s) => s.setAgentQueue);
  const wasRunningByAgent = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!agentId) return;
    const wasRun = wasRunningByAgent.current[agentId] ?? false;
    wasRunningByAgent.current[agentId] = isRunning;
    if (wasRun && !isRunning && queue.length > 0) {
      const [next, ...rest] = queue;
      setAgentQueue(agentId, rest);
      if (next) {
        void dispatchTurn({
          content: next.content,
          atts: next.attachments,
          override: next.override,
          agentId: next.agentId,
        });
      }
    }
  }, [agentId, isRunning, queue, dispatchTurn, setAgentQueue]);

  const enqueue = useCallback(
    (turn: QueuedTurn) => {
      if (!agentId) return;
      const prev =
        (useAppStore.getState().agentQueue[agentId] as ReadonlyArray<QueuedTurn> | undefined) ??
        EMPTY;
      setAgentQueue(agentId, [...prev, turn]);
    },
    [agentId, setAgentQueue],
  );

  const removeQueued = useCallback(
    (id: string) => {
      if (!agentId) return;
      const prev =
        (useAppStore.getState().agentQueue[agentId] as ReadonlyArray<QueuedTurn> | undefined) ??
        EMPTY;
      setAgentQueue(
        agentId,
        prev.filter((q) => q.id !== id),
      );
    },
    [agentId, setAgentQueue],
  );

  const editQueued = useCallback(
    (id: string) => {
      if (!agentId) return;
      const prev =
        (useAppStore.getState().agentQueue[agentId] as ReadonlyArray<QueuedTurn> | undefined) ??
        EMPTY;
      const item = prev.find((q) => q.id === id);
      if (!item) {
        return;
      }
      setAgentQueue(
        agentId,
        prev.filter((q) => q.id !== id),
      );
      onEdit(item);
    },
    [agentId, setAgentQueue, onEdit],
  );

  const clearQueue = useCallback(() => {
    if (!agentId) return;
    setAgentQueue(agentId, EMPTY);
  }, [agentId, setAgentQueue]);

  return { queue, enqueue, removeQueued, editQueued, clearQueue };
}
