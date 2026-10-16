import type { Agent, Workflow } from '@goodboy/types';

type Params = {
  readonly workflow: Workflow;
  readonly agent: Agent;
};

export const stepNumberOf = ({ workflow, agent }: Params): number | null => {
  const index = [...workflow.steps]
    .sort((left, right) => left.ordinal - right.ordinal)
    .findIndex((step) => step.id === agent.stepId);
  return index < 0 ? null : index + 1;
};
