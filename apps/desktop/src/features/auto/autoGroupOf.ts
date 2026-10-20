import { parseAutoDelegationRole } from '@goodboy/core';
import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import type { AutoDeliveredResult, AutoTreeView } from '../../store/slices/auto-view/state';
import { AGENT_KIND_META, classifyAgent, kindForRole, type AgentKind } from '../session/agent-kind';
import type { RowPhase } from '../workTreeModel/rowState';
import { autoChildLabelsOf } from './autoChildLabelsOf';
import { autoRowFacts } from './autoRowFacts';
import { isAutoChildNeverStarted } from './isAutoChildNeverStarted';

export type AutoChildState =
  'running' | 'done' | 'failed' | 'timedOut' | 'blocked' | 'neverStarted' | 'retried' | 'queued';

export type AutoGroupChild = Readonly<{
  agentId: AgentId;
  delegationId: string | null;
  kind: AgentKind;
  noun: string;
  label: string;
  asked: string | null;
  state: AutoChildState;
  reason: string | null;
  outcome: string | null;
  createdAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
}>;

export type AutoGroup = Readonly<{
  sessionId: SessionId;
  rootAgentId: AgentId;
  title: string | null;
  word: string;
  phase: RowPhase;
  children: ReadonlyArray<AutoGroupChild>;
}>;

type Params = {
  readonly view: AutoTreeView;
  readonly agents: ReadonlyArray<Agent>;
  readonly now: number;
};

type TimeParams = {
  readonly value: string | undefined;
};

const timeOf = ({ value }: TimeParams): number | null => {
  if (value === undefined) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

type TextParams = {
  readonly value: unknown;
};

const textOf = ({ value }: TextParams): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

type OutcomeParams = {
  readonly results: ReadonlyArray<AutoDeliveredResult>;
  readonly agent: Agent | null;
  readonly agentId: AgentId;
};

const outcomeOf = ({ results, agent, agentId }: OutcomeParams): string | null => {
  const delivered = results
    .filter((result) => result.childAgentId === agentId)
    .map((result) => textOf({ value: result.summary }))
    .filter((summary) => summary !== null)
    .at(-1);
  return delivered ?? textOf({ value: agent?.outputSummary });
};

type SettledParams = {
  readonly delegation: AutoDelegation;
};

const settledStateOf = ({ delegation }: SettledParams): AutoChildState => {
  switch (delegation.outcome) {
    case 'completed':
      return 'done';
    case 'timed_out':
      return 'timedOut';
    case 'blocked':
      return 'blocked';
    case 'failed':
    case 'stopped':
    case null:
      return 'failed';
    default: {
      const exhaustive: never = delegation.outcome;
      return exhaustive;
    }
  }
};

type StateParams = {
  readonly delegation: AutoDelegation;
  readonly agent: Agent | null;
  readonly isRetried: boolean;
  readonly now: number;
};

const stateOf = ({ delegation, agent, isRetried, now }: StateParams): AutoChildState => {
  if (isRetried) {
    return 'retried';
  }
  switch (delegation.state) {
    case 'accepted':
    case 'starting':
      return isAutoChildNeverStarted({ delegation, childAgent: agent, now })
        ? 'neverStarted'
        : 'queued';
    case 'awaiting_confirm':
      return 'queued';
    case 'running':
    case 'paused':
      return 'running';
    case 'settled':
      return settledStateOf({ delegation });
    default: {
      const exhaustive: never = delegation.state;
      return exhaustive;
    }
  }
};

type DelegationChildParams = StateParams & {
  readonly labels: ReadonlyMap<AgentId, string>;
  readonly results: ReadonlyArray<AutoDeliveredResult>;
};

const childOfDelegation = (params: DelegationChildParams): AutoGroupChild => {
  const { delegation, agent, results, labels } = params;
  const role = parseAutoDelegationRole({ role: delegation.role });
  const kind: AgentKind = role === null ? 'generic' : kindForRole({ role });
  return {
    agentId: delegation.childAgentId,
    delegationId: delegation.id,
    kind,
    noun: AGENT_KIND_META[kind].noun,
    label: labels.get(delegation.childAgentId) ?? AGENT_KIND_META[kind].noun,
    asked: textOf({ value: delegation.request.task }),
    state: stateOf(params),
    reason: delegation.reason,
    outcome: outcomeOf({ results, agent, agentId: delegation.childAgentId }),
    createdAt: delegation.createdAt,
    startedAt: timeOf({ value: agent?.startedAt }),
    finishedAt: delegation.settledAt,
  };
};

type LinkedStateParams = {
  readonly agent: Agent;
};

const linkedStateOf = ({ agent }: LinkedStateParams): AutoChildState => {
  switch (agent.status) {
    case 'running':
      return 'running';
    case 'completed':
    case 'skipped':
      return 'done';
    case 'blocked':
      return 'blocked';
    case 'failed':
    case 'stopped':
      return 'failed';
    case 'pending':
      return 'queued';
    default: {
      const exhaustive: never = agent.status;
      return exhaustive;
    }
  }
};

type LinkedParams = {
  readonly agent: Agent;
  readonly results: ReadonlyArray<AutoDeliveredResult>;
};

const childOfLinkedAgent = ({ agent, results }: LinkedParams): AutoGroupChild => {
  const kind = classifyAgent({ agent, override: null });
  return {
    agentId: agent.id,
    delegationId: null,
    kind,
    noun: AGENT_KIND_META[kind].noun,
    label: AGENT_KIND_META[kind].noun,
    asked: null,
    state: linkedStateOf({ agent }),
    reason: null,
    outcome: outcomeOf({ results, agent, agentId: agent.id }),
    createdAt: null,
    startedAt: timeOf({ value: agent.startedAt }),
    finishedAt: timeOf({ value: agent.completedAt }),
  };
};

export const autoGroupOf = ({ view, agents, now }: Params): AutoGroup | null => {
  const facts = autoRowFacts({ view });
  if (facts === null) {
    return null;
  }
  const rootAgentId = view.tree.rootAgentId;
  const byId = new Map<string, Agent>(agents.map((agent) => [agent.id, agent]));
  const retriedIds = new Set<string>(
    view.delegations.flatMap((delegation) =>
      delegation.retryOf === null ? [] : [delegation.retryOf],
    ),
  );
  const labels = autoChildLabelsOf({ delegations: view.delegations });
  const known = new Set<string>(view.delegations.map((delegation) => delegation.childAgentId));
  const fromDelegations = view.delegations
    .filter((delegation) => !delegation.isAdopted)
    .sort((first, second) => first.slot - second.slot || first.createdAt - second.createdAt)
    .map((delegation) =>
      childOfDelegation({
        delegation,
        agent: byId.get(delegation.childAgentId) ?? null,
        isRetried: retriedIds.has(delegation.id),
        now,
        results: view.deliveredResults,
        labels,
      }),
    );
  const fromLinks = agents
    .filter((agent) => agent.parentAgentId === rootAgentId && !known.has(agent.id))
    .map((agent) => childOfLinkedAgent({ agent, results: view.deliveredResults }));
  return {
    sessionId: view.tree.sessionId,
    rootAgentId,
    title: textOf({ value: byId.get(rootAgentId)?.name }),
    word: facts.word,
    phase: facts.phase,
    children: [...fromDelegations, ...fromLinks],
  };
};
