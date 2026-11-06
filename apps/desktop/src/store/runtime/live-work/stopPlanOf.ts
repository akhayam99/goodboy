import {
  brandId,
  type Agent,
  type AgentId,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { isTurnStateLive } from '../../../features/session/agent-lifecycle';
import { isKeptWait } from './isKeptWait';
import { liveAgentsOf } from './liveAgentsOf';
import { selectLiveWork, type LiveWork, type LiveWorkState } from './selectLiveWork';

export type StopWorkScope =
  Readonly<{ kind: 'all' }> | Readonly<{ kind: 'session'; sessionId: SessionId }>;

type Target = Readonly<{
  sessionId: SessionId;
  agent: Agent;
  wasLive: boolean;
}>;

export type StopPlan = Readonly<{
  targets: ReadonlyArray<Target>;
  orphanRunIds: ReadonlyArray<ProviderRunId>;
  startingAgentIds: ReadonlyArray<AgentId>;
  decidingRuns: LiveWork['decidingRuns'];
}>;

type ScopeParams = Readonly<{
  scope: StopWorkScope;
  sessionId: SessionId;
}>;

const isInScope = ({ scope, sessionId }: ScopeParams): boolean =>
  scope.kind === 'all' || scope.sessionId === sessionId;

type Params = Readonly<{
  state: LiveWorkState;
  scope: StopWorkScope;
  keptRuns: ReadonlySet<ProviderRunId>;
}>;

const targetsOf = ({ state, scope, keptRuns }: Params): ReadonlyArray<Target> =>
  Object.keys(state.sessionPhaseRuns).flatMap((key) => {
    const sessionId = brandId<SessionId>({ value: key });
    if (!isInScope({ scope, sessionId })) {
      return [];
    }
    return liveAgentsOf({ state, sessionId }).flatMap((agent) => {
      const turnState = state.agentTurnState[agent.id];
      if (isKeptWait({ turnState, keptRuns })) {
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

type OrphanParams = Params &
  Readonly<{
    targets: ReadonlyArray<Target>;
  }>;

type Orphans = Pick<StopPlan, 'orphanRunIds' | 'startingAgentIds'>;

const orphansOf = ({ state, scope, targets, keptRuns }: OrphanParams): Orphans => {
  const targeted = new Set<AgentId>(targets.map((target) => target.agent.id));
  const runIds = new Set<ProviderRunId>();
  const startingAgentIds: AgentId[] = [];
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
        startingAgentIds.push(brandId<AgentId>({ value: agentId }));
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
  return { orphanRunIds: [...runIds], startingAgentIds };
};

export const stopPlanOf = ({ state, scope, keptRuns }: Params): StopPlan => {
  const targets = targetsOf({ state, scope, keptRuns });
  return {
    targets,
    ...orphansOf({ state, scope, targets, keptRuns }),
    decidingRuns: selectLiveWork({ state }).decidingRuns.filter((run) =>
      isInScope({ scope, sessionId: run.sessionId }),
    ),
  };
};
