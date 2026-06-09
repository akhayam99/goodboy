import type { AgentId, IsoDateTime, SessionId, TurnState, WorkflowRunId } from '@goodboy/types';
import { discardWorkflowInSession, updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { cancelledRunIds, deriveSessionState } from '../../session-mutators';
import type { GetFn, SetFn } from './types';

export const discardWorkflow = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId) => {
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const run = session.workflowRuns.find((r) => r.id === workflowRunId);
    if (!run || run.discardedAt) return;

    const runs = state.sessionPhaseRuns[sessionId] ?? [];
    const directIds = new Set(
      runs.filter((r) => r.workflowRunId === workflowRunId).map((r) => r.id),
    );
    const ownRuns = runs.filter(
      (r) => directIds.has(r.id) || (r.parentAgentId != null && directIds.has(r.parentAgentId)),
    );

    const now = new Date().toISOString() as IsoDateTime;
    const frozen: Record<AgentId, TurnState> = {};
    for (const r of ownRuns) {
      const turn = state.agentTurnState[r.id];
      if (turn?.kind !== 'running') continue;
      cancelledRunIds.add(turn.runId);
      await cancelTurn(turn.runId).catch(() => undefined);
      frozen[r.id] = { kind: 'idle', lastActivityAt: now };
    }

    await discardWorkflowInSession(tauriDatabase, sessionId, workflowRunId, now);

    let derived: TurnState | null = null;
    set((s) => {
      const nextTurnState = { ...s.agentTurnState, ...frozen };
      const sessionRuns = s.sessionPhaseRuns[sessionId] ?? [];
      const survivorStates = sessionRuns
        .map((a) => nextTurnState[a.id])
        .filter((st): st is NonNullable<typeof st> => st !== undefined);
      derived = deriveSessionState(survivorStates, now);
      return {
        agentTurnState: nextTurnState,
        sessions: s.sessions.map((sess) =>
          sess.id === sessionId
            ? {
                ...sess,
                workflowRuns: sess.workflowRuns.map((r) =>
                  r.id === workflowRunId ? { ...r, discardedAt: now } : r,
                ),
                state: derived!,
                updatedAt: now,
              }
            : sess,
        ),
      };
    });
    if (derived !== null) {
      await updateSessionState(tauriDatabase, sessionId, derived, now).catch(() => undefined);
    }
  };
};
