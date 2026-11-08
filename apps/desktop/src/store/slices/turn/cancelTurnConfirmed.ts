import { CHECK_STATE } from '../notifications/errorRecovery';
import type { AgentId, IsoDateTime, SessionId, TurnState } from '@goodboy/types';
import { updateSessionState } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn, listLiveRunIds } from '../../../features/chat/turn';
import { revealPacer } from '../../../features/chat/reveal/revealPacer';
import { applyAgentTurnState, cancelledRunIds } from '../sessions/sessionMutators';
import { awaitRunStopped } from '../agents/awaitRunStopped';
import { dropAutoMessages } from '../agentQueue/dropAutoMessages';
import type { CancelTurnReason } from './cancelCurrentTurn';
import { nowIso } from '../project-mounts/nowIso';
import { markStoppedBy } from './markStoppedBy';
import { clearAgentStopping, markAgentStopping } from './stoppingAgents';
import { stopRequests } from './stopRequests';
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

type ReasonParams = Readonly<{
  reason: CancelTurnReason;
}>;

const isStopByYou = ({ reason }: ReasonParams): boolean => reason === 'user' || reason === 'leave';

const isStop = ({ reason }: ReasonParams): boolean => reason === 'auto' || isStopByYou({ reason });

export const cancelTurnConfirmed = (set: SetFn, get: GetFn) => {
  const stop = async ({ sessionId, agentId, reason }: Params): Promise<CancelOutcome> => {
    const agentState = get().agentTurnState[agentId];
    if (agentState?.kind !== 'running' && agentState?.kind !== 'blocked') {
      cancelTurnStartWindow({ agentId });
      return { outcome: 'exited', exitedAt: now() };
    }
    const isReported = isStopByYou({ reason });
    const { runId } = agentState;
    stopRequests.request({ agentId, runId, at: Date.now() });
    cancelledRunIds.add(runId);
    revealPacer.flushRun({ runId, agentId });
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
        if (isReported) {
          void get().reportError({
            recovery: CHECK_STATE,
            title: "Couldn't stop the agent",
            error: cause,
            sessionId,
          });
        }
        return FAILED;
      }
    }
    let hasStopped = false;
    try {
      hasStopped = await awaitRunStopped({ runId });
    } catch (waitError) {
      cancelledRunIds.delete(runId);
      if (isReported) {
        void get().reportError({
          recovery: CHECK_STATE,
          title: "Couldn't stop the agent",
          error: waitError,
          sessionId,
        });
      }
      return FAILED;
    }
    if (!hasStopped) {
      if (isReported) {
        void get().reportError({
          recovery: CHECK_STATE,
          title: "The agent hasn't stopped yet",
          error: new Error('The process is still running. Press Stop again to retry.'),
          severity: 'warning',
          sessionId,
        });
      }
      return { outcome: 'still_running', exitedAt: null };
    }
    stopRequests.settle({ agentId });
    const exitedAt = now();
    const idleState: TurnState = { kind: 'idle', lastActivityAt: exitedAt };
    const derived = applyAgentTurnState(set, sessionId, agentId, idleState, exitedAt);
    try {
      await updateSessionState(tauriDatabase, sessionId, derived, exitedAt);
    } catch (error) {
      void get().reportError({
        recovery: CHECK_STATE,
        title: "Couldn't save the stopped state",
        error,
        severity: 'warning',
        sessionId,
      });
    }
    if (isReported) {
      await markStoppedBy({ set, get, sessionId, agentId, at: exitedAt, by: 'you' });
    }
    if (reason === 'user') {
      void get().joinFanOutParent({ sessionId, agentId });
    }
    return { outcome: 'exited', exitedAt };
  };

  return async (params: Params): Promise<CancelOutcome> => {
    const { sessionId, agentId, reason } = params;
    markAgentStopping({ agentId });
    let outcome: CancelOutcome = FAILED;
    try {
      if (isStop({ reason })) {
        await dropAutoMessages({ set, get, agentId });
      }
      outcome = await stop(params);
      return outcome;
    } finally {
      if (reason === 'auto') {
        await markStoppedBy({
          set,
          get,
          sessionId,
          agentId,
          at: outcome.exitedAt ?? now(),
          by: 'auto',
        });
      }
      clearAgentStopping({ agentId });
      if (outcome.outcome !== 'exited' && reason !== 'leave') {
        void get().drainAgentQueue({ sessionId, agentId });
      }
    }
  };
};
