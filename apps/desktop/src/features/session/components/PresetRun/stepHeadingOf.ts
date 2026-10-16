import type { Agent, Workflow } from '@goodboy/types';

type Params = {
  readonly agent: Agent;
  readonly stepAgent: Agent | null;
  readonly workflow: Workflow;
  readonly role: string;
};

export const stepHeadingOf = ({ agent, stepAgent, workflow, role }: Params): string => {
  const index =
    stepAgent === null
      ? -1
      : [...workflow.steps]
          .sort((left, right) => left.ordinal - right.ordinal)
          .findIndex((step) => step.id === stepAgent.stepId);
  if (index < 0) {
    return `${role} · ${agent.name}`;
  }
  if (stepAgent !== null && stepAgent.id !== agent.id) {
    return `Step ${index + 1} · ${role} · ${agent.name}`;
  }
  return `Step ${index + 1} · ${role}`;
};
