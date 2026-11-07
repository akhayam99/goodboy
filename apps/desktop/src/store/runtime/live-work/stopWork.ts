import { CHECK_STATE } from '../../slices/notifications/errorRecovery';
import type { ProviderRunId } from '@goodboy/types';
import { cancelTurn } from '../../../features/chat/turn';
import type { AppStore } from '../../store';
import { cancelledRunIds } from '../../slices/sessions/sessionMutators';
import type { CancelTurnReason } from '../../slices/turn/cancelCurrentTurn';
import { cancelTurnStartWindow } from '../../slices/turn/turnStartWindow';
import { NO_KEPT_RUNS, endedWaitingRunsOf } from './endedWaitingRunsOf';
import { stopPlanOf, type StopWorkScope } from './stopPlanOf';

export type StopWorkResult = Readonly<{
  stopped: number;
  stillRunning: number;
}>;

export type StopWorkState = Pick<
  AppStore,
  | 'sessions'
  | 'sessionPhaseRuns'
  | 'agentTurnState'
  | 'orchestratingWorkflowRuns'
  | 'cancelTurnConfirmed'
  | 'stopWorkflowRunNow'
  | 'reportError'
>;

type Params = Readonly<{
  getState: () => StopWorkState;
  scope: StopWorkScope;
  reason: CancelTurnReason;
}>;

type OrphanCancelParams = Readonly<{
  runId: ProviderRunId;
}>;

const cancelOrphanRun = async ({ runId }: OrphanCancelParams): Promise<boolean> => {
  cancelledRunIds.add(runId);
  try {
    await cancelTurn(runId);
    return true;
  } catch {
    cancelledRunIds.delete(runId);
    return false;
  }
};

export const stopWork = async ({ getState, scope, reason }: Params): Promise<StopWorkResult> => {
  const isLeavingEverything = reason === 'leave' && scope.kind === 'all';
  const keptRuns = isLeavingEverything
    ? await endedWaitingRunsOf({ state: getState() })
    : NO_KEPT_RUNS;
  const state = getState();
  const { targets, orphanRunIds, startingAgentIds } = stopPlanOf({ state, scope, keptRuns });
  for (const agentId of startingAgentIds) {
    cancelTurnStartWindow({ agentId });
  }
  const isReported = reason === 'user' || reason === 'leave';
  const [settled, orphanOutcomes] = await Promise.all([
    Promise.allSettled(
      targets.map((target) =>
        getState().cancelTurnConfirmed({
          sessionId: target.sessionId,
          agentId: target.agent.id,
          reason,
        }),
      ),
    ),
    Promise.all(orphanRunIds.map((runId) => cancelOrphanRun({ runId }))),
  ]);
  let stopped = 0;
  let stillRunning = orphanOutcomes.filter((isCancelled) => !isCancelled).length;
  for (const [index, outcome] of settled.entries()) {
    const target = targets[index];
    if (outcome.status === 'rejected') {
      stillRunning += 1;
      if (isReported) {
        void getState().reportError({
          recovery: CHECK_STATE,
          title: "Couldn't stop the agent",
          error: outcome.reason,
          sessionId: target?.sessionId,
        });
      }
      continue;
    }
    if (outcome.value.outcome !== 'exited') {
      stillRunning += 1;
      continue;
    }
    if (target?.wasLive === true) {
      stopped += 1;
    }
  }
  const { decidingRuns } = stopPlanOf({ state: getState(), scope, keptRuns });
  const runOutcomes = await Promise.all(
    decidingRuns.map(({ sessionId, workflowRunId }) =>
      getState().stopWorkflowRunNow(sessionId, workflowRunId),
    ),
  );
  stillRunning += runOutcomes.filter((outcome) => outcome !== 'stopped').length;
  return { stopped, stillRunning };
};
