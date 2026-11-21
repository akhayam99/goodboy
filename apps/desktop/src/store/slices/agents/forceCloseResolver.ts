import type { AgentId, IsoDateTime, ProviderRunId, SessionId, TurnState } from '@goodboy/types';
import { updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn, listLiveRunIds } from '../../../features/chat/turn';
import { CHECK_STATE } from '../notifications/errorRecovery';
import { abandonWorktreeWriter } from '../../../features/worktree/worktree';
import { agentWritePaths } from '../resolve/agentWritePath';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import { applyAgentTurnState, cancelledRunIds } from '../sessions/sessionMutators';
import type { GetFn, SetFn } from './types';

export type ForceCloseOutcome = 'closed' | 'still_running';

type CancelParams = Readonly<{
  runId: ProviderRunId;
}>;

const cancelFailureOf = async ({
  runId,
}: CancelParams): Promise<{ readonly cause: unknown } | null> => {
  try {
    await cancelTurn(runId);
    return null;
  } catch (error) {
    try {
      return (await listLiveRunIds()).has(runId) ? { cause: error } : null;
    } catch (probeError) {
      return { cause: probeError };
    }
  }
};

export const forceCloseResolver = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId): Promise<ForceCloseOutcome> => {
    const turnState = get().agentTurnState[agentId];
    if (turnState?.kind === 'running') {
      cancelledRunIds.add(turnState.runId);
      const failure = await cancelFailureOf({ runId: turnState.runId });
      if (failure !== null) {
        cancelledRunIds.delete(turnState.runId);
        void get().reportError({
          recovery: CHECK_STATE,
          title: "Couldn't stop the fix",
          error: failure.cause,
          sessionId,
        });
        return 'still_running';
      }
    }
    await get().recordResolvePhase({ sessionId, agentId, phase: 'cancelled' });
    const now = new Date().toISOString() as IsoDateTime;
    await invokeAgentUpdateStatus(agentId, { status: 'skipped', completedAt: now }).catch(
      () => undefined,
    );
    const refreshed = await invokeAgentList(sessionId).catch(() => null);
    if (refreshed !== null) {
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
      }));
    }
    const idleState: TurnState = { kind: 'idle', lastActivityAt: now };
    const derived = applyAgentTurnState(set, sessionId, agentId, idleState, now);
    await updateSessionState(tauriDatabase, sessionId, derived, now).catch(() => undefined);
    for (const path of await agentWritePaths({ get, sessionId, agentId })) {
      await abandonWorktreeWriter({ path, holder: agentId });
    }
    await get().drainResolveQueue({ sessionId });
    return 'closed';
  };
};
