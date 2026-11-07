import type { Agent, Workflow } from '@goodboy/types';
import { stepNumberOf } from './stepNumberOf';

type Params = {
  readonly agent: Agent;
  readonly stepAgent: Agent | null;
  readonly workflow: Workflow;
  readonly role: string;
};

export const stepHeadingOf = ({ agent, stepAgent, workflow, role }: Params): string => {
  const number = stepAgent === null ? null : stepNumberOf({ workflow, agent: stepAgent });
  const stepName =
    stepAgent === null || stepAgent.id !== agent.id
      ? null
      : (workflow.steps.find((step) => step.id === agent.stepId)?.name.trim() ?? null);
  const name = agent.name.trim();
  const shownName = name === '' || name === role || name === stepName ? null : name;
  return [
    ...(number === null ? [] : [`Step ${number}`]),
    role,
    ...(shownName === null ? [] : [shownName]),
  ].join(' · ');
};
