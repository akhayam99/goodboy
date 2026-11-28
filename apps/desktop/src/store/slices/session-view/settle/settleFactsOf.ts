import { msOf } from '@goodboy/core/attention';
import type { Agent, Session } from '@goodboy/types';
import { viewedAgentIdOf, type ViewedState } from '../../../../shared/utils/viewedAgentIdOf';
import { unreadAgentsOf } from '../../agents/unreadAgentsOf';
import type { SettleFacts } from '../attentionFactsOf';
import type { SessionSettle } from './sessionSettleOf';

type Params = {
  readonly state: ViewedState;
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
  readonly settle: SessionSettle;
  readonly isRunLive: boolean;
};

type ReadParams = Pick<Params, 'state' | 'session' | 'agents'>;

type StopParams = Pick<Params, 'session' | 'agents'>;

type LatestParams = {
  readonly times: ReadonlyArray<number | null>;
};

const latestOf = ({ times }: LatestParams): number | null => {
  const known = times.flatMap((time) => (time === null ? [] : [time]));
  return known.length === 0 ? null : Math.max(...known);
};

const unreadAtOf = ({ state, session, agents }: ReadParams) => {
  const unread = unreadAgentsOf({
    agents,
    viewedAgentId: viewedAgentIdOf({ state, sessionId: session.id }),
  });
  const times = unread.map((agent) => msOf({ value: agent.lastFinishedAt }));
  return times.includes(null) ? null : latestOf({ times });
};

const stoppedRunAtOf = ({ session, agents }: StopParams): number | null => {
  const stoppedIds = new Set(
    session.workflowRuns.filter((run) => run.orchestrationStop !== undefined).map((run) => run.id),
  );
  const own = agents.filter(
    (agent) => agent.workflowRunId !== undefined && stoppedIds.has(agent.workflowRunId),
  );
  return latestOf({
    times: own.flatMap((agent) => [
      msOf({ value: agent.completedAt }),
      msOf({ value: agent.stoppedAt }),
      msOf({ value: agent.startedAt }),
    ]),
  });
};

export const settleFactsOf = ({
  state,
  session,
  agents,
  settle,
  isRunLive,
}: Params): SettleFacts => ({
  isSettled: settle.isSettled,
  settledAt: settle.settledAt,
  isRunLive,
  unreadAt: unreadAtOf({ state, session, agents }),
  stoppedRunAt: stoppedRunAtOf({ session, agents }),
});
