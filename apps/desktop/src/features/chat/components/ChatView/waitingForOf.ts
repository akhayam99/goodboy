import type { Agent, AgentId } from '@goodboy/types';
import { AGENT_KIND_META, classifyAgent } from '../../../session/agent-kind';
import { joinNouns } from '../../../auto/joinNouns';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly parentId: AgentId | null;
};

export const waitingForOf = ({ agents, parentId }: Params): string | null => {
  if (parentId === null) {
    return null;
  }
  const nouns = [
    ...new Set(
      agents
        .filter(
          (agent) =>
            agent.parentAgentId === parentId &&
            (agent.status === 'running' || agent.status === 'pending'),
        )
        .map((agent) => AGENT_KIND_META[classifyAgent({ agent, override: null })].noun),
    ),
  ];
  return nouns.length === 0 ? null : joinNouns({ nouns });
};
