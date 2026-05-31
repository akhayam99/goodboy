import type { AgentId, IsoDateTime, SessionId, TurnState, WorkflowId } from '@goodboy/types';
import { discardWorkflowInSession, updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { cancelledRunIds, deriveSessionState } from '../../session-mutators';
import type { GetFn, SetFn } from './types';

export function discardWorkflow(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, workflowId: WorkflowId) => {
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session || !session.workflowIds.includes(workflowId)) return;
    if (session.discardedWorkflowIds?.includes(workflowId)) return;

    const workflow =
      (state.sessionWorkflows[sessionId] ?? []).find((w) => w.id === workflowId) ??
      (state.phaseTemplates[session.workspaceId] ?? []).find((w) => w.id === workflowId);
    const stepIds = new Set((workflow?.steps ?? []).map((s) => s.id));
    const runs = state.sessionPhaseRuns[sessionId] ?? [];
    const directIds = new Set(
      runs.filter((r) => r.stepId != null && stepIds.has(r.stepId)).map((r) => r.id),
    );
    const ownRuns = runs.filter(
      (r) => directIds.has(r.id) || (r.parentAgentId != null && directIds.has(r.parentAgentId)),
    );

    const now = new Date().toISOString() as IsoDateTime;
    const frozen: Record<AgentId, TurnState> = {};
    for (const run of ownRuns) {
      const turn = state.agentTurnState[run.id];
      if (turn?.kind !== 'running') continue;
      cancelledRunIds.add(turn.runId);
      await cancelTurn(turn.runId).catch(() => undefined);
      frozen[run.id] = { kind: 'idle', lastActivityAt: now };
    }

    await discardWorkflowInSession(tauriDatabase, sessionId, workflowId, now);

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
                discardedWorkflowIds: [...(sess.discardedWorkflowIds ?? []), workflowId],
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
}
