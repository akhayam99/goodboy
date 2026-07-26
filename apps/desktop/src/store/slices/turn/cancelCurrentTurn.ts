import type { AgentId, IsoDateTime, SessionId, TurnState } from '@goodboy/types';
import { updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { applyAgentTurnState, cancelledRunIds } from '../../session-mutators';
import type { GetFn, SetFn } from './types';

export const cancelCurrentTurn = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId?: AgentId) => {
    const activeAgentId = agentId ?? get().selectedAgentId[sessionId] ?? null;
    if (activeAgentId == null) {
      return;
    }
    const agentState = get().agentTurnState[activeAgentId];
    if (agentState?.kind !== 'running') {
      return;
    }
    cancelledRunIds.add(agentState.runId);
    await cancelTurn(agentState.runId).catch(() => undefined);
    const now = new Date().toISOString() as IsoDateTime;
    const idleState: TurnState = { kind: 'idle', lastActivityAt: now };
    const derived = applyAgentTurnState(set, sessionId, activeAgentId, idleState, now);
    await updateSessionState(tauriDatabase, sessionId, derived, now).catch(() => undefined);
  };
};
