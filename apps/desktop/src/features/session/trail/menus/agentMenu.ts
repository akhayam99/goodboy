import type { Agent, AgentId } from '@goodboy/types';
import type { CrumbMenuAction, CrumbMenuGroup, CrumbMenuModel, CrumbMenuRow } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { AgentStateGroup, AgentStateWord } from '../../agentStateWord';

type Params = {
  readonly peers: ReadonlyArray<Agent>;
  readonly currentAgentId: AgentId;
  readonly stateOf: (agent: Agent) => AgentStateWord;
  readonly roleOf: (agent: Agent) => { readonly label: string; readonly tone: string };
  readonly modelOf: (agent: Agent) => string | null;
  readonly actions: ReadonlyArray<CrumbMenuAction>;
  readonly onSelect: (agentId: AgentId) => void;
};

const GROUPS: ReadonlyArray<{ readonly id: AgentStateGroup; readonly label: string }> = [
  { id: 'needs-you', label: 'Needs you' },
  { id: 'running', label: 'Running' },
  { id: 'done', label: 'Done' },
];

export const agentMenu = ({
  peers,
  currentAgentId,
  stateOf,
  roleOf,
  modelOf,
  actions,
  onSelect,
}: Params): CrumbMenuModel => {
  const recentFirst = [...peers].sort((first, second) => second.ordinal - first.ordinal);
  const rowOf = (agent: Agent): CrumbMenuRow => {
    const role = roleOf(agent);
    const state = stateOf(agent);
    return {
      id: agent.id,
      lead: { kind: 'icon', icon: CONCEPT_ICONS.agents, className: role.tone },
      label: agent.name,
      secondary: role.label,
      metaA: modelOf(agent),
      state: { word: state.word, tone: state.tone },
      isCurrent: agent.id === currentAgentId,
      isDisabled: false,
      indent: 0,
      onSelect: () => onSelect(agent.id),
    };
  };
  const groups: ReadonlyArray<CrumbMenuGroup> = GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    rows: recentFirst.filter((agent) => stateOf(agent).group === group.id).map(rowOf),
  })).filter((group) => group.rows.length > 0);

  return {
    title: 'Agents',
    context: 'this session',
    count: peers.length,
    triggerLabel: 'Switch agent',
    groups,
    actions: actions.slice(0, 2),
    width: 'regular',
    filterPlaceholder: 'Filter agents',
  };
};
