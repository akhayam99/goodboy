import type { Agent } from '@goodboy/types';

type Params = {
  readonly agent: Agent;
  readonly now: number;
};

export const agentEndOf = ({ agent, now }: Params): string =>
  agent.completedAt ?? agent.stoppedAt ?? new Date(now).toISOString();
