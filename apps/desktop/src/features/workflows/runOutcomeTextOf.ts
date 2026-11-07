import type { Agent, WorkflowRun } from '@goodboy/types';

type Params = {
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
};

export const runOutcomeTextOf = ({ run, agents }: Params): string => {
  const summary = run.orchestratorSummary?.trim() ?? '';
  if (summary !== '') {
    return summary;
  }
  const lastStep = agents
    .filter((agent) => agent.parentAgentId == null && agent.status === 'completed')
    .sort((left, right) => right.ordinal - left.ordinal)[0];
  return lastStep?.outputSummary?.trim() ?? '';
};
