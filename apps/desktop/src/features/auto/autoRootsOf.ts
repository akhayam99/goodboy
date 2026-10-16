import type { Agent } from '@goodboy/types';
import { classifyAgent, isStandaloneAgent, type AgentKind } from '../session/agent-kind';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly kindOverride: Readonly<Record<string, AgentKind>>;
};

export const autoRootsOf = ({ agents, kindOverride }: Params): ReadonlyArray<Agent> =>
  agents
    .filter(
      (agent) =>
        isStandaloneAgent({ agent }) &&
        classifyAgent({ agent, override: kindOverride[agent.id] ?? null }) === 'auto',
    )
    .sort((a, b) => b.ordinal - a.ordinal);
