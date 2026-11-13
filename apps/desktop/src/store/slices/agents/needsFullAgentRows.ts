import type { Agent, AgentStatus } from '@goodboy/types';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
};

const LIVE_STATUSES: ReadonlySet<AgentStatus> = new Set(['pending', 'running', 'blocked']);

export const needsFullAgentRows = ({ agents }: Params): boolean =>
  agents.some(
    (agent) =>
      LIVE_STATUSES.has(agent.status) || (agent.status === 'stopped' && agent.stoppedBy === 'app'),
  );
