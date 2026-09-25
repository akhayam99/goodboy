import { useCallback } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { AgentQueuedTurn } from '../../../../../store/slices/agentQueue/types';
import type { QueuedTurn } from '../lib';

type UseMessageQueueArgs = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly onEdit: (item: QueuedTurn) => void;
};

const EMPTY: ReadonlyArray<AgentQueuedTurn> = [];

export const useMessageQueue = ({ sessionId, agentId, onEdit }: UseMessageQueueArgs) => {
  const queue = useAppStore((s) => (agentId ? (s.agentQueue[agentId] ?? EMPTY) : EMPTY));
  const enqueueAgentMessage = useAppStore((s) => s.enqueueAgentMessage);
  const removeQueuedMessage = useAppStore((s) => s.removeQueuedMessage);
  const takeQueuedMessage = useAppStore((s) => s.takeQueuedMessage);
  const sendQueuedNow = useAppStore((s) => s.sendQueuedNow);
  const sendAgentMessageNow = useAppStore((s) => s.sendAgentMessageNow);

  const enqueue = useCallback(
    (turn: QueuedTurn) => void enqueueAgentMessage({ turn }),
    [enqueueAgentMessage],
  );

  const sendNow = useCallback(
    (turn: QueuedTurn) => void sendAgentMessageNow({ sessionId, turn }),
    [sendAgentMessageNow, sessionId],
  );

  const removeQueued = useCallback(
    (itemId: string) => {
      if (!agentId) return;
      void removeQueuedMessage({ agentId, itemId });
    },
    [agentId, removeQueuedMessage],
  );

  const sendQueued = useCallback(
    (itemId: string) => {
      if (!agentId) return;
      void sendQueuedNow({ sessionId, agentId, itemId });
    },
    [agentId, sendQueuedNow, sessionId],
  );

  const editQueued = useCallback(
    (itemId: string) => {
      if (!agentId) return;
      const item = takeQueuedMessage({ agentId, itemId });
      if (item === null) return;
      onEdit(item);
    },
    [agentId, takeQueuedMessage, onEdit],
  );

  return { queue, enqueue, sendNow, removeQueued, sendQueued, editQueued };
};
