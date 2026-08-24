import type { Agent } from '@goodboy/types';
import { agentHomeLens, type AgentHomeLens, type AgentKind } from '../../agent-kind';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly selectedAgent: Agent;
  readonly rootAgent: Agent;
  readonly home: AgentHomeLens;
  readonly kindOf: (agent: Agent) => AgentKind;
};

const byOrdinal = (first: Agent, second: Agent): number => first.ordinal - second.ordinal;

export const switcherPeers = ({
  agents,
  selectedAgent,
  rootAgent,
  home,
  kindOf,
}: Params): ReadonlyArray<Agent> => {
  const parentAgentId = selectedAgent.parentAgentId ?? null;

  if (parentAgentId != null) {
    const selectedKind = kindOf(selectedAgent);
    return agents
      .filter(
        (agent) =>
          agent.parentAgentId === parentAgentId &&
          (kindOf(agent) === selectedKind || agent.id === selectedAgent.id),
      )
      .sort(byOrdinal);
  }

  const workflowRunId = rootAgent.workflowRunId ?? null;

  if (workflowRunId == null) {
    return agents
      .filter((agent) => agent.parentAgentId == null)
      .filter((agent) => agentHomeLens(agent, kindOf(agent)) === home)
      .sort((first, second) => byOrdinal(second, first));
  }

  return agents
    .filter(
      (agent) =>
        agent.workflowRunId === workflowRunId &&
        agent.parentAgentId == null &&
        agent.stepId != null &&
        agent.status !== 'pending',
    )
    .sort(byOrdinal);
};
