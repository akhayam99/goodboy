import {
  brandId,
  type Agent,
  type AgentId,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { cancelTurn, listLiveRunIds } from '../../../features/chat/turn';
import { isTurnStateLive } from '../../../features/session/agent-lifecycle';
import type { AppStore } from '../../store';
import { cancelledRunIds } from '../../slices/sessions/sessionMutators';
import type { CancelTurnReason } from '../../slices/turn/cancelCurrentTurn';
import { cancelTurnStartWindow } from '../../slices/turn/turnStartWindow';
import { liveAgentsOf } from './liveAgentsOf';
import { selectLiveWork } from './selectLiveWork';

export type StopWorkScope =
  Readonly<{ kind: 'all' }> | Readonly<{ kind: 'session'; sessionId: SessionId }>;

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

const NO_RUNS: ReadonlySet<ProviderRunId> = new Set();

type Target = Readonly<{
  sessionId: SessionId;
  agent: Agent;
  wasLive: boolean;
}>;

type ScopeParams = Readonly<{
  scope: StopWorkScope;
  sessionId: SessionId;
}>;

const isInScope = ({ scope, sessionId }: ScopeParams): boolean =>
  scope.kind === 'all' || scope.sessionId === sessionId;

type StateParams = Readonly<{
  state: StopWorkState;
  scope: StopWorkScope;
}>;

type KeptParams = Readonly<{
  keptRuns: ReadonlySet<ProviderRunId>;
}>;

type TargetsParams = StateParams & KeptParams;

const targetsOf = ({ state, scope, keptRuns }: TargetsParams): ReadonlyArray<Target> =>
  Object.keys(state.sessionPhaseRuns).flatMap((key) => {
    const sessionId = brandId<SessionId>({ value: key });
    if (!isInScope({ scope, sessionId })) {
      return [];
    }
    return liveAgentsOf({ state, sessionId }).flatMap((agent) => {
      const turnState = state.agentTurnState[agent.id];
      if (turnState?.kind === 'blocked' && keptRuns.has(turnState.runId)) {
        return [];
      }
      return [
        {
          sessionId,
          agent,
          wasLive: isTurnStateLive({ turnState, includeBlocked: true }),
        },
      ];
    });
  });

type OrphanParams = StateParams &
  KeptParams &
  Readonly<{
    targets: ReadonlyArray<Target>;
  }>;

const orphanRunIdsOf = ({
  state,
  scope,
  targets,
  keptRuns,
}: OrphanParams): ReadonlyArray<ProviderRunId> => {
  const targeted = new Set<AgentId>(targets.map((target) => target.agent.id));
  const runIds = new Set<ProviderRunId>();
  const claimed = new Set<ProviderRunId>([
    ...keptRuns,
    ...targets.flatMap((target) => {
      const turnState = state.agentTurnState[target.agent.id];
      return turnState?.kind === 'running' || turnState?.kind === 'blocked'
        ? [turnState.runId]
        : [];
    }),
  ]);
  for (const session of state.sessions) {
    if (!isInScope({ scope, sessionId: session.id }) || session.state.kind !== 'running') {
      continue;
    }
    if (!claimed.has(session.state.runId)) {
      runIds.add(session.state.runId);
    }
  }
  if (scope.kind === 'all') {
    for (const [agentId, turnState] of Object.entries(state.agentTurnState)) {
      if (targeted.has(brandId<AgentId>({ value: agentId }))) {
        continue;
      }
      if (turnState?.kind === 'starting') {
        cancelTurnStartWindow({ agentId: brandId<AgentId>({ value: agentId }) });
        continue;
      }
      if (
        (turnState?.kind === 'running' || turnState?.kind === 'blocked') &&
        !claimed.has(turnState.runId)
      ) {
        runIds.add(turnState.runId);
      }
    }
  }
  return [...runIds];
};

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

type WaitingParams = Readonly<{
  state: StopWorkState;
}>;

const endedWaitingRunsOf = async ({
  state,
}: WaitingParams): Promise<ReadonlySet<ProviderRunId>> => {
  const waiting = Object.values(state.agentTurnState).flatMap((turnState) =>
    turnState?.kind === 'blocked' ? [turnState.runId] : [],
  );
  if (waiting.length === 0) {
    return NO_RUNS;
  }
  const live = await listLiveRunIds();
  return new Set(waiting.filter((runId) => !live.has(runId)));
};

export const stopWork = async ({ getState, scope, reason }: Params): Promise<StopWorkResult> => {
  const isLeavingEverything = reason === 'leave' && scope.kind === 'all';
  const keptRuns = isLeavingEverything ? await endedWaitingRunsOf({ state: getState() }) : NO_RUNS;
  const state = getState();
  const targets = targetsOf({ state, scope, keptRuns });
  const orphans = orphanRunIdsOf({ state, scope, targets, keptRuns });
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
    Promise.all(orphans.map((runId) => cancelOrphanRun({ runId }))),
  ]);
  let stopped = 0;
  let stillRunning = orphanOutcomes.filter((isCancelled) => !isCancelled).length;
  for (const [index, outcome] of settled.entries()) {
    const target = targets[index];
    if (outcome.status === 'rejected') {
      stillRunning += 1;
      if (isReported) {
        void getState().reportError({
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
  const deciding = selectLiveWork({ state: getState() }).decidingRuns.filter((run) =>
    isInScope({ scope, sessionId: run.sessionId }),
  );
  await Promise.all(
    deciding.map(({ sessionId, workflowRunId }) =>
      getState().stopWorkflowRunNow(sessionId, workflowRunId),
    ),
  );
  return { stopped, stillRunning };
};
