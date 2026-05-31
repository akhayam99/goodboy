import type { IsoDateTime, SessionId, TurnState } from '@goodboy/types';
import { updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { applyAgentTurnState, cancelledRunIds } from '../../session-mutators';
import type { GetFn, SetFn } from './types';

export function cancelCurrentTurn(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId) => {
    const selectedAgentId = get().selectedAgentId[sessionId] ?? null;
    if (!selectedAgentId) return;
    const agentState = get().agentTurnState[selectedAgentId];
    if (agentState?.kind !== 'running') return;
    cancelledRunIds.add(agentState.runId);
    await cancelTurn(agentState.runId).catch(() => undefined);
    const now = new Date().toISOString() as IsoDateTime;
    const idleState: TurnState = { kind: 'idle', lastActivityAt: now };
    const derived = applyAgentTurnState(set, sessionId, selectedAgentId, idleState, now);
    await updateSessionState(tauriDatabase, sessionId, derived, now).catch(() => undefined);
  };
}
