import type { AutoDelegation, AutoDelegationState, AutoOutcome } from '@goodboy/db';
import { brandId, type Agent, type AgentId, type AutoDelegationId } from '@goodboy/types';
import { sceneClock } from '../../../sceneClock';
import { AUTO_ROOT_ID, IMPLEMENTER_ID, type AutoSceneData } from '../../u24/autoSceneSeed';

type Extra = {
  readonly key: string;
  readonly role: string;
  readonly name: string;
  readonly task: string;
  readonly minute: number;
  readonly state: AutoDelegationState;
  readonly outcome: AutoOutcome | null;
  readonly status: Agent['status'];
  readonly parent: AgentId;
};

const clock = sceneClock({ anchor: '2026-10-13T12:21:00.000Z' });

const EXTRAS: ReadonlyArray<Extra> = [
  {
    key: 'scout-callers',
    role: 'scout',
    name: 'Scout',
    task: 'Find every caller of postCredit in payments-api and note which ones retry',
    minute: 5,
    state: 'settled',
    outcome: 'completed',
    status: 'completed',
    parent: AUTO_ROOT_ID,
  },
  {
    key: 'scout-ledger',
    role: 'scout',
    name: 'Scout',
    task: 'Read how ledger-core stores the idempotency key for a credit',
    minute: 6,
    state: 'settled',
    outcome: 'completed',
    status: 'completed',
    parent: AUTO_ROOT_ID,
  },
  {
    key: 'scout-apply',
    role: 'scout',
    name: 'Scout',
    task: 'Where applyCredit returns the first result for a key it has seen',
    minute: 10,
    state: 'settled',
    outcome: 'completed',
    status: 'completed',
    parent: IMPLEMENTER_ID,
  },
  {
    key: 'reviewer-key',
    role: 'reviewer',
    name: 'Reviewer',
    task: 'Check that the key is built once per credit, before the retry loop',
    minute: 11,
    state: 'paused',
    outcome: null,
    status: 'running',
    parent: IMPLEMENTER_ID,
  },
  {
    key: 'ci-knip',
    role: 'ci-fixer',
    name: 'CI fixer',
    task: 'Fix the stale knip cache in notify-relay',
    minute: 12,
    state: 'settled',
    outcome: 'failed',
    status: 'failed',
    parent: AUTO_ROOT_ID,
  },
  {
    key: 'scribe-notes',
    role: 'scribe',
    name: 'Scribe',
    task: 'Write the changelog line for the retry fix in payments-api',
    minute: 13,
    state: 'running',
    outcome: null,
    status: 'running',
    parent: AUTO_ROOT_ID,
  },
];

type MinuteParams = {
  readonly minute: number;
};

const atOf = ({ minute }: MinuteParams): string =>
  `2026-10-13T12:${String(minute).padStart(2, '0')}:00.000Z`;

type SceneParams = {
  readonly scene: AutoSceneData;
};

export const runTraceSceneOf = ({ scene }: SceneParams): AutoSceneData => {
  const [template] = scene.view.delegations;
  const [rootAgent] = scene.agents;
  if (template === undefined || rootAgent === undefined) {
    return scene;
  }
  const delegations = EXTRAS.map((extra): AutoDelegation => ({
    ...template,
    id: brandId<AutoDelegationId>({ value: `mock-auto-delegation-${extra.key}` }),
    childAgentId: brandId<AgentId>({ value: `mock-auto-${extra.key}` }),
    role: extra.role,
    request: { task: extra.task, reason: extra.task },
    state: extra.state,
    outcome: extra.outcome,
    retryOf: null,
    reviseOf: null,
    createdAt: clock.ms({ at: atOf({ minute: extra.minute }) }),
    settledAt:
      extra.state === 'settled' ? clock.ms({ at: atOf({ minute: extra.minute + 1 }) }) : null,
    result: null,
  }));
  const agents = EXTRAS.map((extra): Agent => ({
    ...rootAgent,
    id: brandId<AgentId>({ value: `mock-auto-${extra.key}` }),
    name: extra.name,
    kind: extra.role,
    status: extra.status,
    startedAt: clock.iso({ at: atOf({ minute: extra.minute }) }),
    parentAgentId: extra.parent,
  }));
  return {
    ...scene,
    view: { ...scene.view, delegations: [...scene.view.delegations, ...delegations] },
    agents: [...scene.agents, ...agents],
  };
};
