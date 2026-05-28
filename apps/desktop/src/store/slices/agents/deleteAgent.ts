import type { AgentId, IsoDateTime, SessionId, TurnState } from '@goodboy/types';
import { updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { applySessionUpdate, cancelledRunIds } from '../../session-mutators';
import type { GetFn, SetFn } from './types';

// Deleting an agent has to do three things the original implementation
// skipped, in this order:
//   1. If the agent owns the active session run, cancel it. Otherwise the
//      rust provider process keeps streaming, those events keep landing in
//      applySessionUpdate, and `session.state.kind` stays `'running'`
//      forever. ChatView falls back to that field whenever the fallback
//      agent has no per-agent turn state, so a sibling chat starts showing
//      a permanent "thinking…" indicator.
//   2. Drop every per-agent map entry. Leaving `agentTurnState[agentId]`
//      and friends behind is both a memory leak and a foot-gun: if the
//      same id ever gets re-issued (or, more realistically, if a selector
//      iterates all agent state) we surface ghosts of a deleted agent.
//   3. Only then remove the DB row and re-pick the selected agent.
export function deleteAgent(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, agentId: AgentId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    const agentTurn = get().agentTurnState[agentId];
    const sessionRunId = session?.state.kind === 'running' ? session.state.runId : null;
    const agentRunId = agentTurn?.kind === 'running' ? agentTurn.runId : null;
    const ownsActiveRun =
      sessionRunId !== null && agentRunId !== null && sessionRunId === agentRunId;

    if (ownsActiveRun && sessionRunId !== null) {
      cancelledRunIds.add(sessionRunId);
      await cancelTurn(sessionRunId).catch(() => undefined);
      const now = new Date().toISOString() as IsoDateTime;
      const idleState: TurnState = { kind: 'idle', lastActivityAt: now };
      await updateSessionState(tauriDatabase, sessionId, idleState, now).catch(() => undefined);
      applySessionUpdate(set, sessionId, idleState);
    }

    await tauriDatabase.execute('DELETE FROM agents WHERE id = ?', [agentId]);
    const refreshed = await invokeAgentList(sessionId);
    set((s) => {
      // Clear selection, never auto-pick a sibling. Picking a 'fallback'
      // dumps the user into a chat they didn't ask for; the empty-state
      // 'pick_agent' scenario already covers the no-selection case and is
      // explicit about what they can do next.
      const wasSelected = s.selectedAgentId[sessionId] === agentId;
      const nextSelected = { ...s.selectedAgentId };
      if (wasSelected) {
        delete nextSelected[sessionId];
      }
      const nextTurnState = { ...s.agentTurnState };
      delete nextTurnState[agentId];
      const nextTranscripts = { ...s.transcripts };
      delete nextTranscripts[agentId];
      const nextDraft = { ...s.agentDraft };
      delete nextDraft[agentId];
      const nextHistory = { ...s.agentRunHistory };
      delete nextHistory[agentId];
      const nextModelOverride = { ...s.agentModelOverride };
      delete nextModelOverride[agentId];
      const nextKindOverride = { ...s.agentKindOverride };
      delete nextKindOverride[agentId];
      return {
        sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
        selectedAgentId: nextSelected,
        agentTurnState: nextTurnState,
        transcripts: nextTranscripts,
        agentDraft: nextDraft,
        agentRunHistory: nextHistory,
        agentModelOverride: nextModelOverride,
        agentKindOverride: nextKindOverride,
      };
    });
  };
}
