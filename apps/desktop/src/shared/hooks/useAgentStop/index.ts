import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { stopRequests, type StopRequest } from '../../../store/slices/turn/stopRequests';

export type StopPhase = 'idle' | 'stopping' | 'stalled';

const STALLED_AFTER_MS = 5_000;

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

type Result = Readonly<{
  phase: StopPhase;
  isLive: boolean;
  stop: () => void;
}>;

export const useAgentStop = ({ sessionId, agentId }: Params): Result => {
  const cancelCurrentTurn = useAppStore((state) => state.cancelCurrentTurn);
  const turn = useAppStore((state) => (agentId === null ? null : state.agentTurnState[agentId]));
  const request: StopRequest | null = useSyncExternalStore(
    (listener) => stopRequests.subscribe({ listener }),
    () => (agentId === null ? null : stopRequests.of({ agentId })),
  );
  const [now, setNow] = useState(() => Date.now());
  const isLive = turn?.kind === 'running';
  const requestedAt =
    turn?.kind === 'running' && request !== null && request.runId === turn.runId
      ? request.at
      : null;

  useEffect(() => {
    if (requestedAt === null) {
      return;
    }
    setNow(Date.now());
    const remaining = Math.max(0, requestedAt + STALLED_AFTER_MS - Date.now());
    const handle = window.setTimeout(() => setNow(Date.now()), remaining + 1);
    return () => window.clearTimeout(handle);
  }, [requestedAt]);

  const stop = useCallback(() => {
    if (agentId === null) {
      return;
    }
    void cancelCurrentTurn(sessionId, agentId, 'user');
  }, [agentId, cancelCurrentTurn, sessionId]);

  if (requestedAt === null) {
    return { phase: 'idle', isLive, stop };
  }
  return { phase: now - requestedAt >= STALLED_AFTER_MS ? 'stalled' : 'stopping', isLive, stop };
};
