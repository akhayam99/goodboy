import type { Agent, AgentId } from '@goodboy/types';
import { agentHasUnread } from './agentHasUnread';

type Params = {
  readonly agents: ReadonlyArray<Agent> | undefined;
  readonly viewedAgentId?: AgentId | null;
};

type AgentParams = {
  readonly agent: Agent;
};

const finishedAtOf = ({ agent }: AgentParams): number =>
  agent.lastFinishedAt == null ? 0 : Date.parse(agent.lastFinishedAt);

export const unreadAgentsOf = ({ agents, viewedAgentId = null }: Params): ReadonlyArray<Agent> =>
  (agents ?? [])
    .filter((agent) => agentHasUnread(agent, agent.id === viewedAgentId))
    .sort((a, b) => finishedAtOf({ agent: b }) - finishedAtOf({ agent: a }));
