import type { WorkNodeState } from '@goodboy/ui';
import type { Agent, AgentId, TurnState } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import type { AgentKind } from '../../session/agent-kind';
import { autoTreeWordOf } from '../autoTreeWordOf';
import { isAutoTreeActive } from '../autoTreePhases';
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
  startedAtMs: number | null;
  endedAtMs: number | null;
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

export const delegationNodeOf = ({ card }: NodeParams): WorkNodeState => {
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
  readonly agent: Agent | null;
  readonly routing: RailRouting;
  readonly rootTurn: TurnState | null;
};

type StartParams = {
  readonly agent: Agent | null;
};

const startedAtOf = ({ agent }: StartParams): number | null => {
  const parsed = agent?.startedAt == null ? Number.NaN : Date.parse(agent.startedAt);
  return Number.isNaN(parsed) ? null : parsed;
};

const rootRowOf = ({ view, agent, routing, rootTurn }: RootParams): RailRow => {
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
    startedAtMs: startedAtOf({ agent }),
    endedAtMs: isAutoTreeActive({ phase: view.tree.phase }) ? null : view.tree.updatedAt,
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
  startedAtMs: null,
  endedAtMs: null,
  isLive: false,
});

export const railRowsOf = ({
  view,
  agents,
  rootRouting,
  rootTurn = null,
}: RowParams): ReadonlyArray<RailRow> => {
  const rootAgent = agents.find((agent) => agent.id === view.tree.rootAgentId) ?? null;
  const latestByChild = new Map<string, DelegationCardModel>();
  for (const delegation of view.delegations) {
    if (delegation.isAdopted) {
      continue;
    }
    const childAgent = agents.find((agent) => agent.id === delegation.childAgentId) ?? null;
    latestByChild.set(delegation.childAgentId, delegationCardOf({ delegation, childAgent }));
  }
  const children = [...latestByChild.values()].map((card): RailRow => ({
    id: card.childAgentId,
    agentId: card.childAgentId,
    kind: 'child',
    role: card.role,
    label: card.roleLabel,
    task: card.task,
    node: delegationNodeOf({ card }),
    word: card.status.word,
    tone: card.status.tone,
    provider: card.provider,
    model: card.model,
    effort: card.effort,
    startedAtMs: card.startedAtMs,
    endedAtMs: card.endedAtMs,
    isLive: card.status.isLive,
  }));
  return [rootRowOf({ view, agent: rootAgent, routing: rootRouting, rootTurn }), ...children];
};
