import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { cancelledRunIds, deriveSessionState } from '../../session-mutators';
import type { GetFn, SetFn } from './types';

export function deleteAgent(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, agentId: AgentId) => {
    const agentTurn = get().agentTurnState[agentId];
    const agentRunId = agentTurn?.kind === 'running' ? agentTurn.runId : null;
    if (agentRunId !== null) {
      cancelledRunIds.add(agentRunId);
      await cancelTurn(agentRunId).catch(() => undefined);
    }

    await tauriDatabase.execute('DELETE FROM agents WHERE id = ?', [agentId]);
    const refreshed = await invokeAgentList(sessionId);
    let derived: ReturnType<typeof deriveSessionState> | null = null;
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
      const nextProviderOverride = { ...s.agentProviderOverride };
      delete nextProviderOverride[agentId];
      const nextEffortOverride = { ...s.agentEffortOverride };
      delete nextEffortOverride[agentId];
      const nextKindOverride = { ...s.agentKindOverride };
      delete nextKindOverride[agentId];
      const nextResolverKickoff = { ...s.pendingResolverKickoff };
      delete nextResolverKickoff[agentId];
      const nextResolverState = { ...s.resolverState };
      delete nextResolverState[agentId];
      const survivorStates = refreshed
        .map((a) => nextTurnState[a.id])
        .filter((st): st is NonNullable<typeof st> => st !== undefined);
      derived = deriveSessionState(survivorStates, new Date().toISOString() as IsoDateTime);
      return {
        sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
        selectedAgentId: nextSelected,
        agentTurnState: nextTurnState,
        transcripts: nextTranscripts,
        agentDraft: nextDraft,
        agentRunHistory: nextHistory,
        agentModelOverride: nextModelOverride,
        agentProviderOverride: nextProviderOverride,
        agentEffortOverride: nextEffortOverride,
        agentKindOverride: nextKindOverride,
        pendingResolverKickoff: nextResolverKickoff,
        resolverState: nextResolverState,
        sessions: s.sessions.map((sess) =>
          sess.id === sessionId ? { ...sess, state: derived! } : sess,
        ),
      };
    });
    if (derived !== null) {
      await updateSessionState(
        tauriDatabase,
        sessionId,
        derived,
        new Date().toISOString() as IsoDateTime,
      ).catch(() => undefined);
    }
  };
}
