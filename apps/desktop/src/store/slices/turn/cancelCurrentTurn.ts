import type { IsoDateTime, SessionId, TurnState } from '@goodboy/types';
import { updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { applySessionUpdate, cancelledRunIds } from '../../session-mutators';
import type { GetFn, SetFn } from './types';

export function cancelCurrentTurn(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.state.kind !== 'running') return;
    const cancelAgentId = get().selectedAgentId[sessionId] ?? null;
    cancelledRunIds.add(session.state.runId);
    await cancelTurn(session.state.runId).catch(() => undefined);
    const now = new Date().toISOString() as IsoDateTime;
    const idleState: TurnState = { kind: 'idle', lastActivityAt: now };
    await updateSessionState(tauriDatabase, sessionId, idleState, now).catch(() => undefined);
    applySessionUpdate(set, sessionId, idleState, cancelAgentId ?? undefined);
  };
}
