import type { AgentId, Session, SessionId, WorkflowRunId } from '@goodboy/types';
import { isTurnStateLive } from '../../../features/session/agent-lifecycle';
import type { AppState } from '../../types';

export type LiveWorkState = Pick<
  AppState,
  'sessions' | 'sessionPhaseRuns' | 'agentTurnState' | 'orchestratingWorkflowRuns'
>;

export type SessionLiveWork = Readonly<{
  isRunning: boolean;
  isBlocked: boolean;
  isDeciding: boolean;
}>;

export type LiveWork = Readonly<{
  runningAgentIds: ReadonlyArray<AgentId>;
  blockedAgentIds: ReadonlyArray<AgentId>;
  decidingRunIds: ReadonlyArray<WorkflowRunId>;
  liveSessionIds: ReadonlyArray<SessionId>;
}>;

type SessionParams = {
  readonly state: Pick<
    LiveWorkState,
    'sessionPhaseRuns' | 'agentTurnState' | 'orchestratingWorkflowRuns'
  >;
  readonly session: Session;
};

type LiveWorkParams = {
  readonly state: LiveWorkState;
};

export const decidingRunIdsOf = ({ state, session }: SessionParams): ReadonlyArray<WorkflowRunId> =>
  session.workflowRuns
    .filter((run) => state.orchestratingWorkflowRuns?.[run.id] === true && run.discardedAt == null)
    .map((run) => run.id);

export const liveWorkOfSession = ({ state, session }: SessionParams): SessionLiveWork => {
  const runs = state.sessionPhaseRuns[session.id] ?? [];
  return {
    isRunning:
      session.state.kind === 'running' ||
      session.state.kind === 'starting' ||
      runs.some(
        (run) =>
          run.status === 'running' || isTurnStateLive({ turnState: state.agentTurnState[run.id] }),
      ),
    isBlocked: runs.some((run) => state.agentTurnState[run.id]?.kind === 'blocked'),
    isDeciding: decidingRunIdsOf({ state, session }).length > 0,
  };
};

export const selectLiveWork = ({ state }: LiveWorkParams): LiveWork => {
  const runningAgentIds: AgentId[] = [];
  const blockedAgentIds: AgentId[] = [];
  for (const [agentId, turnState] of Object.entries(state.agentTurnState)) {
    if (turnState.kind === 'blocked') {
      blockedAgentIds.push(agentId as AgentId);
      continue;
    }
    if (isTurnStateLive({ turnState })) {
      runningAgentIds.push(agentId as AgentId);
    }
  }
  const decidingRunIds: WorkflowRunId[] = [];
  const liveSessionIds: SessionId[] = [];
  for (const session of state.sessions) {
    const deciding = decidingRunIdsOf({ state, session });
    decidingRunIds.push(...deciding);
    const live = liveWorkOfSession({ state, session });
    if (live.isRunning || live.isBlocked || live.isDeciding) {
      liveSessionIds.push(session.id as SessionId);
    }
  }
  return { runningAgentIds, blockedAgentIds, decidingRunIds, liveSessionIds };
};
