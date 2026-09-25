import type { AgentId, IsoDateTime, SessionId, TurnState } from '@goodboy/types';
import { updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { applyAgentTurnState, cancelledRunIds } from '../../session-mutators';
import { cancelTurnStartWindow } from './turnStartWindow';
import type { GetFn, SetFn } from './types';

export type CancelTurnReason = 'user' | 'handoff' | 'teardown';

type MarkStoppedParams = Readonly<{
  set: SetFn;
  sessionId: SessionId;
  agentId: AgentId;
  at: IsoDateTime;
}>;

const markStoppedByUser = async ({
  set,
  sessionId,
  agentId,
  at,
}: MarkStoppedParams): Promise<void> => {
  const stopped = await invokeAgentUpdateStatus(agentId, {
    status: 'stopped',
    stoppedAt: at,
    stoppedBy: 'you',
  }).catch(() => null);
  if (stopped === null) {
    return;
  }
  set((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
        agent.id === agentId ? stopped : agent,
      ),
    },
  }));
};

export const cancelCurrentTurn = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    agentId?: AgentId,
    reason: CancelTurnReason = 'teardown',
  ): Promise<void> => {
    const activeAgentId = agentId ?? get().selectedAgentId[sessionId] ?? null;
    if (activeAgentId == null) {
      return;
    }
    const agentState = get().agentTurnState[activeAgentId];
    if (agentState?.kind !== 'running') {
      cancelTurnStartWindow({ agentId: activeAgentId });
      return;
    }
    cancelledRunIds.add(agentState.runId);
    const now = new Date().toISOString() as IsoDateTime;
    if (reason === 'user') {
      await markStoppedByUser({ set, sessionId, agentId: activeAgentId, at: now });
    }
    await cancelTurn(agentState.runId).catch(() => undefined);
    const idleState: TurnState = { kind: 'idle', lastActivityAt: now };
    const derived = applyAgentTurnState(set, sessionId, activeAgentId, idleState, now);
    await updateSessionState(tauriDatabase, sessionId, derived, now).catch(() => undefined);
  };
};
