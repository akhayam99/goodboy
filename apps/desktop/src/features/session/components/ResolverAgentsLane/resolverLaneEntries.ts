import type { AgentId } from '@goodboy/types';
import type { ResolverLink, ResolverStatus } from '../../resolver-linkage';

const SETTLED_STATUSES: ReadonlyArray<ResolverStatus> = ['resolved', 'stopped'];

export const isResolverSettled = ({ agent, status }: ResolverLink): boolean =>
  agent.doneAt != null || SETTLED_STATUSES.includes(status);

type Params = {
  readonly links: ReadonlyArray<ResolverLink>;
};

export const resolverLaneEntries = ({ links }: Params) => {
  const newestFirst = [...links].sort((a, b) => b.agent.ordinal - a.agent.ordinal);
  return {
    active: newestFirst.filter((link) => !isResolverSettled(link)),
    completed: newestFirst.filter(isResolverSettled),
  };
};

export const activeResolverIds = ({ links }: Params): ReadonlySet<AgentId> =>
  new Set(links.filter((link) => !isResolverSettled(link)).map((link) => link.agent.id));

export const hasOtherActiveResolver = ({
  activeIds,
  agentId,
}: {
  readonly activeIds: ReadonlySet<AgentId>;
  readonly agentId: AgentId;
}): boolean => activeIds.size > (activeIds.has(agentId) ? 1 : 0);

export const isResolverQueueStalled = ({ links }: Params): boolean => {
  const unsettled = links.filter((link) => !isResolverSettled(link));
  return (
    unsettled.some(({ agent }) => agent.status === 'pending') &&
    !unsettled.some(({ agent }) => agent.status === 'running')
  );
};
