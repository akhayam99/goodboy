import type { AgentId, IsoDateTime, SessionId, TurnState } from '@goodboy/types';
import { updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { applyAgentTurnState, cancelledRunIds } from '../sessions/sessionMutators';
import { cancelTurnConfirmed } from './cancelTurnConfirmed';
import { cancelTurnStartWindow } from './turnStartWindow';
import type { GetFn, SetFn } from './types';

export type CancelTurnReason = 'user' | 'handoff' | 'teardown';

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
    if (reason === 'user') {
      await cancelTurnConfirmed(set, get)({ sessionId, agentId: activeAgentId, reason });
      return;
    }
    const agentState = get().agentTurnState[activeAgentId];
    if (agentState?.kind !== 'running') {
      cancelTurnStartWindow({ agentId: activeAgentId });
      return;
    }
    cancelledRunIds.add(agentState.runId);
    const now = new Date().toISOString() as IsoDateTime;
    await cancelTurn(agentState.runId).catch(() => undefined);
    const idleState: TurnState = { kind: 'idle', lastActivityAt: now };
    const derived = applyAgentTurnState(set, sessionId, activeAgentId, idleState, now);
    await updateSessionState(tauriDatabase, sessionId, derived, now).catch(() => undefined);
  };
};
