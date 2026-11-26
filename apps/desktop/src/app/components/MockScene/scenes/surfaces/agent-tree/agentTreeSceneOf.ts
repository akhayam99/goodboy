import type { AutoDelegation, AutoDelegationState, AutoOutcome } from '@goodboy/db';
import {
  brandId,
  type Agent,
  type AgentId,
  type AutoDelegationId,
  type ProviderRunId,
} from '@goodboy/types';
import { sceneClock } from '../../../sceneClock';
import { AUTO_ROOT_ID, IMPLEMENTER_ID, type AutoSceneData } from '../../u24/autoSceneSeed';

type Extra = {
  readonly key: string;
  readonly role: string;
  readonly name: string;
  readonly task: string;
  readonly second: number;
  readonly state: AutoDelegationState;
  readonly outcome: AutoOutcome | null;
  readonly status: Agent['status'];
  readonly parent: AgentId;
  readonly retryOf: string | null;
};

const clock = sceneClock({ anchor: '2026-10-13T12:21:00.000Z' });

const FIRST_TRY = 'implementer-first';

const EXTRAS: ReadonlyArray<Extra> = [
  {
    key: 'scout-callers',
    role: 'scout',
    name: 'Scout',
    task: 'Find every caller of postCredit in payments-api and note which ones retry on a timeout',
    second: 1 * 60 + 30,
    state: 'settled',
    outcome: 'completed',
    status: 'completed',
    parent: AUTO_ROOT_ID,
    retryOf: null,
  },
  {
    key: 'scout-ledger',
    role: 'scout',
    name: 'Scout',
    task: 'Read how ledger-core stores the idempotency key for a credit',
    second: 2 * 60,
    state: 'settled',
    outcome: 'completed',
    status: 'completed',
    parent: AUTO_ROOT_ID,
    retryOf: null,
  },
  {
    key: FIRST_TRY,
    role: 'implementer',
    name: 'Implementer',
    task: 'Post one credit per retry in postCredit and applyCredit.',
    second: 7 * 60,
    state: 'settled',
    outcome: 'failed',
    status: 'failed',
    parent: AUTO_ROOT_ID,
    retryOf: null,
  },
  {
    key: 'scout-apply',
    role: 'scout',
    name: 'Scout',
    task: 'Where applyCredit returns the first result for a key it has seen',
    second: 9 * 60 + 40,
    state: 'settled',
    outcome: 'completed',
    status: 'completed',
    parent: IMPLEMENTER_ID,
    retryOf: null,
  },
  {
    key: 'reviewer-key',
    role: 'reviewer',
    name: 'Reviewer',
    task: 'Check that the key is built once per credit, before the retry loop',
    second: 11 * 60,
    state: 'paused',
    outcome: null,
    status: 'running',
    parent: IMPLEMENTER_ID,
    retryOf: null,
  },
  {
    key: 'investigator-race',
    role: 'investigator',
    name: 'Investigator',
    task: 'Reproduce the double credit when two webhooks arrive together in ledger-core',
    second: 11 * 60 + 30,
    state: 'settled',
    outcome: 'stopped',
    status: 'completed',
    parent: AUTO_ROOT_ID,
    retryOf: null,
  },
  {
    key: 'ci-knip',
    role: 'ci-fixer',
    name: 'CI fixer',
    task: 'Fix the stale knip cache in notify-relay',
    second: 12 * 60,
    state: 'settled',
    outcome: 'failed',
    status: 'failed',
    parent: AUTO_ROOT_ID,
    retryOf: null,
  },
  {
    key: 'docs-runbook',
    role: 'docs',
    name: 'Docs',
    task: 'Update the retry notes in the Northwind runbook',
    second: 12 * 60 + 20,
    state: 'settled',
    outcome: 'completed',
    status: 'completed',
    parent: AUTO_ROOT_ID,
    retryOf: null,
  },
  {
    key: 'scribe-notes',
    role: 'scribe',
    name: 'Scribe',
    task: 'Write the changelog line for the retry fix in payments-api',
    second: 13 * 60,
    state: 'running',
    outcome: null,
    status: 'running',
    parent: AUTO_ROOT_ID,
    retryOf: null,
  },
];

type SecondParams = {
  readonly second: number;
};

const atOf = ({ second }: SecondParams): string => {
  const minutes = Math.floor(second / 60);
  const seconds = second % 60;
  return `2026-10-13T12:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.000Z`;
};

type RunParams = {
  readonly agentId: AgentId;
};

export const runIdOf = ({ agentId }: RunParams): ProviderRunId =>
  brandId<ProviderRunId>({ value: `${agentId}-run` });

export const AGENT_COSTS_USD: Readonly<Record<string, number>> = {
  'mock-auto-planner': 0.12,
  'mock-auto-implementer': 0.19,
  'mock-auto-scout-callers': 0.04,
  'mock-auto-scout-ledger': 0.03,
  'mock-auto-implementer-first': 0.21,
  'mock-auto-scout-apply': 0.05,
  'mock-auto-reviewer-key': 0.04,
  'mock-auto-investigator-race': 0.17,
  'mock-auto-ci-knip': 0.09,
  'mock-auto-docs-runbook': 0.06,
};

type SceneParams = {
  readonly scene: AutoSceneData;
};

type KeyParams = {
  readonly key: string;
};

const idOf = ({ key }: KeyParams) =>
  brandId<AutoDelegationId>({ value: `mock-auto-delegation-${key}` });

export const agentTreeSceneOf = ({ scene }: SceneParams): AutoSceneData => {
  const [template] = scene.view.delegations;
  const [rootAgent] = scene.agents;
  if (template === undefined || rootAgent === undefined) {
    return scene;
  }
  const added = EXTRAS.map((extra): AutoDelegation => ({
    ...template,
    id: idOf({ key: extra.key }),
    childAgentId: brandId<AgentId>({ value: `mock-auto-${extra.key}` }),
    role: extra.role,
    request: { task: extra.task, reason: extra.task },
    state: extra.state,
    outcome: extra.outcome,
    retryOf: null,
    reviseOf: null,
    createdAt: clock.ms({ at: atOf({ second: extra.second }) }),
    settledAt:
      extra.state === 'settled' ? clock.ms({ at: atOf({ second: extra.second + 70 }) }) : null,
    result: null,
  }));
  const retried = scene.view.delegations.map((delegation) =>
    delegation.childAgentId === IMPLEMENTER_ID
      ? { ...delegation, retryOf: idOf({ key: FIRST_TRY }) }
      : delegation,
  );
  const agents = EXTRAS.map((extra): Agent => ({
    ...rootAgent,
    id: brandId<AgentId>({ value: `mock-auto-${extra.key}` }),
    name: extra.name,
    kind: extra.role,
    status: extra.status,
    startedAt: clock.iso({ at: atOf({ second: extra.second }) }),
    parentAgentId: extra.parent,
  }));
  return {
    ...scene,
    view: { ...scene.view, delegations: [...retried, ...added] },
    agents: [...scene.agents, ...agents].map((agent) => ({
      ...agent,
      runId: runIdOf({ agentId: agent.id }),
    })),
  };
};
