import type { Agent, AgentId, ClusterCompletionHold, SessionId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly containerId: AgentId;
  readonly children: ReadonlyArray<Agent>;
  readonly resolvingHoldId: string | null;
};

export type ClusterSourceProgress = Readonly<{
  completed: ReadonlySet<AgentId>;
  released: ReadonlySet<AgentId>;
}>;

type CompletedSourcesParams = {
  readonly holds: ReadonlyArray<ClusterCompletionHold>;
  readonly containerId: AgentId;
  readonly resolvingHoldId: string | null;
};

export const completedSourceIds = ({
  holds,
  containerId,
  resolvingHoldId,
}: CompletedSourcesParams): ReadonlySet<AgentId> =>
  new Set(
    holds
      .filter(
        (hold) =>
          hold.containerAgentId === containerId &&
          (hold.state === 'resolved' || hold.id === resolvingHoldId),
      )
      .map((hold) => hold.sourceAgentId),
  );

const NO_SOURCES: ReadonlySet<AgentId> = new Set();

type CompletedAmongParams = {
  readonly agent: Agent;
  readonly completed: ReadonlySet<AgentId>;
};

export const isCompletedAmong = ({ agent, completed }: CompletedAmongParams): boolean =>
  agent.status === 'completed' || completed.has(agent.id);

type CompletedAttemptParams = {
  readonly agent: Agent;
  readonly holds: ReadonlyArray<ClusterCompletionHold>;
};

export const isCompletedAttempt = ({ agent, holds }: CompletedAttemptParams): boolean =>
  isCompletedAmong({
    agent,
    completed:
      agent.parentAgentId == null
        ? NO_SOURCES
        : completedSourceIds({ holds, containerId: agent.parentAgentId, resolvingHoldId: null }),
  });

export const clusterSourceProgress = ({
  get,
  sessionId,
  containerId,
  children,
  resolvingHoldId,
}: Params): ClusterSourceProgress => {
  const childIds = new Set(children.map((child) => child.id));
  const completed = completedSourceIds({
    holds: get().clusterCompletionHolds?.[sessionId] ?? [],
    containerId,
    resolvingHoldId,
  });
  return {
    completed,
    released: new Set([...completed].filter((sourceId) => childIds.has(sourceId) === false)),
  };
};
