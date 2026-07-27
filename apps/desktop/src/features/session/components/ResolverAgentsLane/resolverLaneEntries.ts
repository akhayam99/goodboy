import type { ResolverLink, ResolverStatus } from '../../resolver-linkage';

const COMPLETED_STATUSES: ReadonlyArray<ResolverStatus> = [
  'resolved',
  'wontfix',
  'stopped',
  'done',
];

type Params = {
  readonly links: ReadonlyArray<ResolverLink>;
};

export const resolverLaneEntries = ({ links }: Params) => {
  const newestFirst = [...links].sort((a, b) => b.agent.ordinal - a.agent.ordinal);
  return {
    active: newestFirst.filter(({ status }) => !COMPLETED_STATUSES.includes(status)),
    completed: newestFirst.filter(({ status }) => COMPLETED_STATUSES.includes(status)),
  };
};
