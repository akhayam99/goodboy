import type { Agent } from '@goodboy/types';
import { notFinishedKindOf } from '@goodboy/core/workflows';

type Params = {
  readonly runs: ReadonlyArray<Agent>;
  readonly agent: Agent;
};

export const isAfterStuckAgent = ({ runs, agent }: Params): boolean => {
  const previous = runs
    .filter(
      (candidate) =>
        candidate.id !== agent.id &&
        candidate.workflowRunId === agent.workflowRunId &&
        candidate.parentAgentId === agent.parentAgentId &&
        candidate.ordinal < agent.ordinal &&
        (candidate.status === 'completed' || candidate.status === 'skipped') &&
        notFinishedKindOf({ agent: candidate }) !== 'dependent',
    )
    .sort((a, b) => b.ordinal - a.ordinal)[0];
  return previous !== undefined && notFinishedKindOf({ agent: previous }) === 'stuck';
};
