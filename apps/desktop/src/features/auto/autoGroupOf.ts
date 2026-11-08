import { parseAutoDelegationRole } from '@goodboy/core/auto';
import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId } from '@goodboy/types';
import { textOf } from '@goodboy/types/helpers';
import { NAMES } from '../../shared/utils/names';
import type { AutoDeliveredResult, AutoTreeView } from '../../store/slices/auto-view/state';
import { AGENT_KIND_META, classifyAgent, kindForRole, type AgentKind } from '../session/agent-kind';
import type { RowPhase } from '../workTreeModel/rowState';
import { autoChildLabelsOf } from './autoChildLabelsOf';
import { autoRowFacts } from './autoRowFacts';
import { isAutoChildStuck } from './isAutoChildStuck';
import { autoSettledStateOf } from './autoSettledStateOf';
import { declaredSummaryOf } from './declaredSummaryOf';
import { delegationMountIdOf } from './delegationMountIdOf';
import { delegationSentenceOf } from './delegationSentenceOf';
import { isAutoDelegationReplaced } from './isAutoDelegationReplaced';
import { isAutoChildGone } from './isAutoChildGone';
import { isAutoChildNeverStarted } from './isAutoChildNeverStarted';

export type AutoChildState =
  | 'running'
  | 'done'
  | 'failed'
  | 'stopped'
  | 'timedOut'
  | 'returned'
  | 'neverStarted'
  | 'retried'
  | 'queued';

export type AutoGroupChild = Readonly<{
  agentId: AgentId;
  delegationId: string | null;
  kind: AgentKind;
  noun: string;
  label: string;
  asked: string | null;
  mountId: string | null;
  state: AutoChildState;
  reason: string | null;
  reasonCode: string | null;
  outcome: string | null;
  createdAt: number | null;
  startedAt: number | null;
  finishedAt: number | null;
  isGone?: boolean;
}>;

export type AutoGroup = Readonly<{
  rootAgentId: AgentId;
  title: string | null;
  word: string;
  phase: RowPhase;
  isStuck: boolean;
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

type OutcomeParams = {
  readonly results: ReadonlyArray<AutoDeliveredResult>;
  readonly agent: Agent | null;
  readonly agentId: AgentId;
  readonly declared: string | null;
  readonly state: AutoChildState;
};

const outcomeOf = ({ results, agent, agentId, declared, state }: OutcomeParams): string | null => {
  const delivered = results
    .filter((result) => result.childAgentId === agentId)
    .map((result) => textOf({ value: result.summary }))
    .filter((summary) => summary !== null)
    .at(-1);
  if (state === 'done') {
    return declared ?? delivered ?? null;
  }
  return delivered ?? textOf({ value: agent?.outputSummary });
};

type StateParams = {
  readonly delegation: AutoDelegation;
  readonly agent: Agent | null;
  readonly isReplaced: boolean;
  readonly now: number;
};

const stateOf = ({ delegation, agent, isReplaced, now }: StateParams): AutoChildState => {
  if (isReplaced && delegation.outcome !== 'blocked') {
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
      return autoSettledStateOf({ outcome: delegation.outcome, isReplaced });
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
  const state = stateOf(params);
  const declared = declaredSummaryOf({ delegation });
  return {
    agentId: delegation.childAgentId,
    delegationId: delegation.id,
    kind,
    noun: AGENT_KIND_META[kind].noun,
    label: labels.get(delegation.childAgentId) ?? AGENT_KIND_META[kind].noun,
    asked: textOf({ value: delegation.request.task }),
    mountId: delegationMountIdOf({ delegation }),
    state,
    reason: delegationSentenceOf({ delegation }),
    reasonCode: delegation.reason,
    outcome: outcomeOf({ results, agent, agentId: delegation.childAgentId, declared, state }),
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
      return 'returned';
    case 'failed':
      return 'failed';
    case 'stopped':
      return 'stopped';
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
  const state = linkedStateOf({ agent });
  return {
    agentId: agent.id,
    delegationId: null,
    kind,
    noun: AGENT_KIND_META[kind].noun,
    label: AGENT_KIND_META[kind].noun,
    asked: null,
    mountId: agent.mountId ?? null,
    state,
    reason: null,
    reasonCode: null,
    outcome: outcomeOf({ results, agent, agentId: agent.id, declared: null, state }),
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
  const labels = autoChildLabelsOf({ delegations: view.delegations });
  const known = new Set<string>([
    ...view.delegations.map((delegation) => delegation.childAgentId),
    ...view.hiddenChildIds,
  ]);
  const fromDelegations = view.delegations
    .filter((delegation) => !delegation.isAdopted)
    .sort((first, second) => first.slot - second.slot || first.createdAt - second.createdAt)
    .map((delegation) =>
      childOfDelegation({
        delegation,
        agent: byId.get(delegation.childAgentId) ?? null,
        isReplaced: isAutoDelegationReplaced({ delegation, delegations: view.delegations }),
        now,
        results: view.deliveredResults,
        labels,
      }),
    );
  const fromLinks = agents
    .filter((agent) => agent.parentAgentId === rootAgentId && !known.has(agent.id))
    .map((agent) => childOfLinkedAgent({ agent, results: view.deliveredResults }));
  const children = [...fromDelegations, ...fromLinks].map((child) =>
    isAutoChildGone({
      state: child.state,
      hasAgent: byId.has(child.agentId),
      reasonCode: child.reasonCode,
    })
      ? { ...child, isGone: true }
      : child,
  );
  const isRunning = facts.phase === 'running';
  const isLive = isRunning || facts.phase === 'failed';
  const isStuck = isLive && children.some((child) => isAutoChildStuck({ child }));
  return {
    rootAgentId,
    title: textOf({ value: byId.get(rootAgentId)?.name }),
    word: isStuck && isRunning ? NAMES.needsYou : facts.word,
    phase: facts.phase,
    isStuck,
    children,
  };
};
