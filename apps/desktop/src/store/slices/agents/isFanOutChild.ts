import type { Agent, AgentId } from '@goodboy/types';
import { classifyAgent, type AgentKind } from '../../../features/session/agent-kind';

type Params = {
  readonly agent: Agent;
  readonly runs: ReadonlyArray<Agent>;
  readonly agentKindOverride: Readonly<Record<AgentId, AgentKind>>;
};

export const isFanOutChild = ({ agent, runs, agentKindOverride }: Params): boolean => {
  if (agent.parentAgentId == null) {
    return false;
  }
  const parent = runs.find((run) => run.id === agent.parentAgentId);
  if (parent === undefined) {
    return false;
  }
  const parentKind = classifyAgent({
    agent: parent,
    override: agentKindOverride[parent.id] ?? null,
  });
  const childKind = classifyAgent({ agent, override: agentKindOverride[agent.id] ?? null });
  return parentKind === childKind;
};
