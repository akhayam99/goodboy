import type { WorkNodeState } from '@goodboy/ui';
import type { Agent, AgentId, TurnState } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import type { AgentKind } from '../../session/agent-kind';
import { autoChildLabelsOf } from '../autoChildLabelsOf';
import { autoTreeWordOf } from '../autoTreeWordOf';
import { delegationCardOf, type DelegationCardModel } from './delegationCardOf';

export type RailRow = Readonly<{
  id: string;
  agentId: AgentId;
  kind: 'root' | 'child';
  role: AgentKind;
  label: string;
  task: string | null;
  node: WorkNodeState;
  word: string;
  tone: Tone;
  provider: string | null;
  model: string | null;
  effort: string | null;
  isLive: boolean;
}>;

type RailRouting = Readonly<{
  provider: string | null;
  model: string | null;
  effort: string | null;
}>;

type RowParams = {
  readonly view: AutoTreeView;
  readonly agents: ReadonlyArray<Agent>;
  readonly rootRouting: RailRouting;
  readonly rootTurn?: TurnState | null;
};

type NodeParams = {
  readonly card: DelegationCardModel;
};

const delegationNodeOf = ({ card }: NodeParams): WorkNodeState => {
  if (card.status.node !== undefined) {
    return card.status.node;
  }
  switch (card.status.word) {
    case 'Done':
      return 'done';
    case 'Failed':
    case 'Timed out':
      return 'failed';
    case 'Blocked':
      return 'alert';
    case 'Stopped':
      return 'stopped';
    case 'Queued':
      return 'queued';
    default:
      return 'running';
  }
};

type RootParams = {
  readonly view: AutoTreeView;
  readonly routing: RailRouting;
  readonly rootTurn: TurnState | null;
};

const rootRowOf = ({ view, routing, rootTurn }: RootParams): RailRow => {
  const state = autoTreeWordOf({ view, rootTurn });
  return {
    id: view.tree.rootAgentId,
    agentId: view.tree.rootAgentId,
    kind: 'root',
    role: 'auto',
    label: 'Auto',
    task: null,
    node: state.node,
    word: state.word,
    tone: 'neutral',
    provider: routing.provider,
    model: routing.model,
    effort: routing.effort,
    isLive: state.isLive,
  };
};

type RestingParams = RailRouting & {
  readonly agentId: AgentId;
};

export const restingRootRowOf = ({ agentId, provider, model, effort }: RestingParams): RailRow => ({
  id: agentId,
  agentId,
  kind: 'root',
  role: 'auto',
  label: 'Auto',
  task: null,
  node: 'queued',
  word: 'Idle',
  tone: 'neutral',
  provider,
  model,
  effort,
  isLive: false,
});

export const railRowsOf = ({
  view,
  agents,
  rootRouting,
  rootTurn = null,
}: RowParams): ReadonlyArray<RailRow> => {
  const latestByChild = new Map<string, DelegationCardModel>();
  for (const delegation of view.delegations) {
    if (delegation.isAdopted) {
      continue;
    }
    const childAgent = agents.find((agent) => agent.id === delegation.childAgentId) ?? null;
    latestByChild.set(delegation.childAgentId, delegationCardOf({ delegation, childAgent }));
  }
  const labels = autoChildLabelsOf({ delegations: view.delegations });
  const children = [...latestByChild.values()].map((card): RailRow => ({
    id: card.childAgentId,
    agentId: card.childAgentId,
    kind: 'child',
    role: card.role,
    label: labels.get(card.childAgentId) ?? card.roleLabel,
    task: card.task,
    node: delegationNodeOf({ card }),
    word: card.status.word,
    tone: card.status.tone,
    provider: card.provider,
    model: card.model,
    effort: card.effort,
    isLive: card.status.isLive,
  }));
  return [rootRowOf({ view, routing: rootRouting, rootTurn }), ...children];
};
