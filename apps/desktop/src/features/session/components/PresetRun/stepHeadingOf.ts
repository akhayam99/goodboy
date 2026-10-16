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
  if (stepAgent === null || number === null) {
    return `${role} · ${agent.name}`;
  }
  if (stepAgent.id !== agent.id) {
    return `Step ${number} · ${role} · ${agent.name}`;
  }
  return `Step ${number} · ${role}`;
};
