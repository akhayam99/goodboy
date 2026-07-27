import type { OrchestrationOverview } from '@goodboy/db';

export type Contributor = {
  readonly label: string;
  readonly sentence: string;
  readonly count: number;
};

type Params = {
  readonly overview: OrchestrationOverview;
};

export const rankContributors = ({ overview }: Params): ReadonlyArray<Contributor> =>
  [
    {
      label: 'consumed a plan',
      sentence: 'sessions that started from a consumed plan',
      count: overview.plannedSessions,
    },
    {
      label: 'ran a workflow',
      sentence: 'sessions that ran a workflow',
      count: overview.workflowSessions,
    },
    {
      label: 'split the work',
      sentence: 'sessions that split work across agents',
      count: overview.splitSessions,
    },
    {
      label: 'resolved review',
      sentence: 'sessions that resolved review threads in the app',
      count: overview.resolverSessions,
    },
  ].sort((a, b) => b.count - a.count);
