import type { AgentId, IsoDateTime, SessionId, TurnState } from '@goodboy/types';
import { updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn, listLiveRunIds } from '../../../features/chat/turn';
import { applyAgentTurnState, cancelledRunIds } from '../sessions/sessionMutators';
import { awaitRunStopped } from '../agents/awaitRunStopped';
import type { CancelTurnReason } from './cancelCurrentTurn';
import { nowIso } from '../project-mounts/nowIso';
import { markStoppedByUser } from './markStoppedByUser';
import { clearAgentStopping, markAgentStopping } from './stoppingAgents';
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

const FAILED: CancelOutcome = { outcome: 'failed', exitedAt: null };

export const cancelTurnConfirmed = (set: SetFn, get: GetFn) => {
  const stop = async ({ sessionId, agentId, reason }: Params): Promise<CancelOutcome> => {
    const agentState = get().agentTurnState[agentId];
    if (agentState?.kind !== 'running') {
      cancelTurnStartWindow({ agentId });
      return { outcome: 'exited', exitedAt: now() };
    }
    const { runId } = agentState;
    cancelledRunIds.add(runId);
    try {
      await cancelTurn(runId);
    } catch (error) {
      let isAlive = true;
      let cause: unknown = error;
      try {
        isAlive = (await listLiveRunIds()).has(runId);
      } catch (probeError) {
        cause = probeError;
      }
      if (isAlive) {
        cancelledRunIds.delete(runId);
        if (reason === 'user') {
          void get().reportError({ title: "Couldn't stop the agent", error: cause, sessionId });
        }
        return FAILED;
      }
    }
    let hasStopped = false;
    try {
      hasStopped = await awaitRunStopped({ runId });
    } catch (waitError) {
      cancelledRunIds.delete(runId);
      if (reason === 'user') {
        void get().reportError({ title: "Couldn't stop the agent", error: waitError, sessionId });
      }
      return FAILED;
    }
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
      await markStoppedByUser({ set, get, sessionId, agentId, at: exitedAt });
      void get().joinFanOutParent({ sessionId, agentId });
    }
    return { outcome: 'exited', exitedAt };
  };

  return async (params: Params): Promise<CancelOutcome> => {
    const { sessionId, agentId } = params;
    markAgentStopping({ agentId });
    let outcome: CancelOutcome = FAILED;
    try {
      outcome = await stop(params);
      return outcome;
    } finally {
      clearAgentStopping({ agentId });
      if (outcome.outcome !== 'exited') {
        void get().drainAgentQueue({ sessionId, agentId });
      }
    }
  };
};
