import type { AgentId, IsoDateTime, SessionId, TurnState } from '@goodboy/types';
import { updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn, listLiveRunIds } from '../../../features/chat/turn';
import { applyAgentTurnState, cancelledRunIds } from '../sessions/sessionMutators';
import { awaitRunStopped } from '../agents/awaitRunStopped';
import type { CancelTurnReason } from './cancelCurrentTurn';
import { nowIso } from '../project-mounts/nowIso';
import { markStoppedByUser } from './markStoppedByUser';
import { restoreAgentStatus } from './restoreAgentStatus';
import { cancelTurnStartWindow } from './turnStartWindow';
import type { GetFn, SetFn } from './types';

export type CancelOutcome = Readonly<{
  outcome: 'exited' | 'still_running' | 'failed';
  exitedAt: IsoDateTime | null;
}>;

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
  reason: CancelTurnReason;
}>;

const now = (): IsoDateTime => nowIso({});

export const cancelTurnConfirmed = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, agentId, reason }: Params): Promise<CancelOutcome> => {
    const agentState = get().agentTurnState[agentId];
    if (agentState?.kind !== 'running') {
      cancelTurnStartWindow({ agentId });
      return { outcome: 'exited', exitedAt: now() };
    }
    const { runId } = agentState;
    const previousStatus = (get().sessionPhaseRuns[sessionId] ?? []).find(
      (agent) => agent.id === agentId,
    )?.status;
    cancelledRunIds.add(runId);
    const stopMark =
      reason === 'user'
        ? await markStoppedByUser({ set, get, sessionId, agentId, at: now() })
        : null;
    try {
      await cancelTurn(runId);
    } catch (error) {
      const live = await listLiveRunIds();
      if (live.has(runId)) {
        cancelledRunIds.delete(runId);
        if (stopMark !== null && previousStatus !== undefined) {
          await restoreAgentStatus({ set, get, sessionId, agentId, status: previousStatus });
        }
        if (reason === 'user') {
          void get().reportError({ title: "Couldn't stop the agent", error, sessionId });
        }
        return { outcome: 'failed', exitedAt: null };
      }
    }
    const hasStopped = await awaitRunStopped({ runId });
    if (!hasStopped) {
      if (reason === 'user') {
        void get().reportError({
          title: "The agent hasn't stopped yet",
          error: new Error('The process is still running. Press Stop again to retry.'),
          severity: 'warning',
          sessionId,
        });
      }
      return { outcome: 'still_running', exitedAt: null };
    }
    const exitedAt = now();
    const idleState: TurnState = { kind: 'idle', lastActivityAt: exitedAt };
    const derived = applyAgentTurnState(set, sessionId, agentId, idleState, exitedAt);
    try {
      await updateSessionState(tauriDatabase, sessionId, derived, exitedAt);
    } catch (error) {
      void get().reportError({
        title: "Couldn't save the stopped state",
        error,
        severity: 'warning',
        sessionId,
      });
    }
    if (reason === 'user') {
      void get().joinFanOutParent({ sessionId, agentId });
    }
    return { outcome: 'exited', exitedAt };
  };
};
