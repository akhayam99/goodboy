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
