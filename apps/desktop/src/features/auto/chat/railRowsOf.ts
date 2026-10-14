import type { WorkNodeState } from '@goodboy/ui';
import type { Agent, AgentId } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import type { AgentKind } from '../../session/agent-kind';
import { autoRowFacts } from '../autoRowFacts';
import { delegationCardOf, type DelegationCardModel } from './delegationCardOf';

export type RailRow = Readonly<{
  id: string;
  agentId: AgentId;
  kind: 'root' | 'child';
  role: AgentKind;
  label: string;
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
};

type NodeParams = {
  readonly card: DelegationCardModel;
};

const childNodeOf = ({ card }: NodeParams): WorkNodeState => {
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
    case 'Needs your OK':
      return 'approval';
    case 'Waiting for an answer':
      return 'question';
    case 'Queued':
      return 'queued';
    default:
      return 'running';
  }
};

const ROOT_NODE_BY_PHASE: Readonly<Record<AutoTreeView['tree']['phase'], WorkNodeState>> = {
  answering: 'running',
  deciding: 'running',
  delegating: 'running',
  waiting: 'running',
  merging: 'running',
  done: 'done',
  blocked: 'alert',
  stopping: 'running',
  stopped: 'stopped',
};

type RootParams = {
  readonly view: AutoTreeView;
  readonly agent: Agent | null;
  readonly routing: RailRouting;
};

type WordParams = {
  readonly view: AutoTreeView;
  readonly facts: ReturnType<typeof autoRowFacts>;
  readonly isApproval: boolean;
};

const rootWordOf = ({ view, facts, isApproval }: WordParams): string => {
  if (facts === null) {
    return view.tree.phase === 'done' ? 'Done' : 'Ready';
  }
  return isApproval ? facts.word : facts.short;
};

type ToneParams = {
  readonly node: WorkNodeState;
  readonly isLive: boolean;
};

const rootToneOf = ({ node, isLive }: ToneParams): Tone => {
  if (node === 'approval' || node === 'alert') {
    return 'warning';
  }
  return isLive ? 'info' : 'neutral';
};

type StartParams = {
  readonly agent: Agent | null;
};

const startedAtOf = ({ agent }: StartParams): number | null => {
  const parsed = agent?.startedAt == null ? Number.NaN : Date.parse(agent.startedAt);
  return Number.isNaN(parsed) ? null : parsed;
};

const rootRowOf = ({ view, agent, routing }: RootParams): RailRow => {
  const facts = autoRowFacts({ view });
  const isApproval = facts?.short === 'Needs you';
  const node: WorkNodeState = isApproval ? 'approval' : ROOT_NODE_BY_PHASE[view.tree.phase];
  const isLive = facts !== null && facts.phase === 'running';
  return {
    id: view.tree.rootAgentId,
    agentId: view.tree.rootAgentId,
    kind: 'root',
    role: 'auto',
    label: 'Auto',
    node,
    word: rootWordOf({ view, facts, isApproval }),
    tone: rootToneOf({ node, isLive }),
    provider: routing.provider,
    model: routing.model,
    effort: routing.effort,
    startedAtMs: startedAtOf({ agent }),
    endedAtMs: view.tree.phase === 'done' ? view.tree.updatedAt : null,
    isLive,
  };
};

export const railRowsOf = ({ view, agents, rootRouting }: RowParams): ReadonlyArray<RailRow> => {
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
    node: childNodeOf({ card }),
    word: card.status.word,
    tone: card.status.tone,
    provider: card.provider,
    model: card.model,
    effort: card.effort,
    startedAtMs: card.startedAtMs,
    endedAtMs: card.endedAtMs,
    isLive: card.status.isLive,
  }));
  return [rootRowOf({ view, agent: rootAgent, routing: rootRouting }), ...children];
};
