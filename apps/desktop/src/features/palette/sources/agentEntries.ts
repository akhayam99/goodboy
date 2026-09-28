import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { AGENT_KIND_META, agentKindPalette, type AgentKind } from '../../session/agent-kind';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { PaletteEntry } from '../types';

export type AgentOpenParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export type AgentKindParams = {
  readonly agent: Agent;
};

type Params = {
  readonly sessionId: SessionId;
  readonly agents: ReadonlyArray<Agent>;
  readonly kindOf: (params: AgentKindParams) => AgentKind;
  readonly open: (params: AgentOpenParams) => void;
};

export const agentEntries = ({
  sessionId,
  agents,
  kindOf,
  open,
}: Params): ReadonlyArray<PaletteEntry> =>
  agents
    .filter((agent) => agent.deletedAt == null)
    .map((agent): PaletteEntry => {
      const kind = kindOf({ agent });
      const agentId = agent.id as AgentId;
      return {
        key: `agent:${agentId}`,
        label: agent.name,
        secondary: [AGENT_KIND_META[kind].label],
        kind: 'agent',
        group: 'agent',
        icon: CONCEPT_ICONS.agents,
        accent: agentKindPalette({ kind }).bg,
        detail: AGENT_KIND_META[kind].label,
        tag: 'Agent',
        target: { kind: 'agent', sessionId, agentId },
        run: () => open({ sessionId, agentId }),
      };
    });
