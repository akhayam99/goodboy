import type { Agent } from '@goodboy/types';

type StatusParams = {
  readonly status: Agent['status'];
};

type AgentParams = {
  readonly agent: Agent;
};

export const isAgentStatusSettled = ({ status }: StatusParams): boolean =>
  status === 'completed' || status === 'skipped';

export const isAgentSettled = ({ agent }: AgentParams): boolean =>
  agent.doneAt != null || isAgentStatusSettled({ status: agent.status });
