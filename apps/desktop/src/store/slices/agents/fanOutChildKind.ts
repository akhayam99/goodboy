import { fanOutCapabilityForRole } from '@goodboy/core';
import type { Agent, AgentId } from '@goodboy/types';
import { classifyAgent, KIND_TO_ROLE, type AgentKind } from '../../../features/session/agent-kind';

type FanOutChildKind = 'cluster' | 'scout-tree';

type Params = {
  readonly agent: Agent;
  readonly runs: ReadonlyArray<Agent>;
  readonly agentKindOverride: Readonly<Record<AgentId, AgentKind>>;
};

const ARTIFACT_CONTAINER_KINDS: ReadonlySet<AgentKind> = new Set<AgentKind>([
  'wireframe',
  'report',
]);

export const fanOutChildKind = ({
  agent,
  runs,
  agentKindOverride,
}: Params): FanOutChildKind | null => {
  if (agent.parentAgentId == null) {
    return null;
  }
  const parent = runs.find((run) => run.id === agent.parentAgentId);
  if (parent === undefined) {
    return null;
  }
  const parentKind = classifyAgent({
    agent: parent,
    override: agentKindOverride[parent.id] ?? null,
  });
  const childKind = classifyAgent({ agent, override: agentKindOverride[agent.id] ?? null });
  if (childKind === 'implementer' && parentKind === 'implementer') {
    return 'cluster';
  }
  if (childKind === 'scout' && ARTIFACT_CONTAINER_KINDS.has(parentKind)) {
    return 'scout-tree';
  }
  if (
    childKind === parentKind &&
    fanOutCapabilityForRole(KIND_TO_ROLE[childKind]).mode !== 'never'
  ) {
    return 'scout-tree';
  }
  return null;
};
