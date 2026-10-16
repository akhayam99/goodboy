import { MODEL_CATALOGS, autoBudgetFacts, autoTreeSpendOf } from '@goodboy/core';
import type { AutoArtifactLedgerRow, AutoDelegation, AutoPhase } from '@goodboy/db';
import {
  brandId,
  type Agent,
  type AgentId,
  type ArtifactId,
  type AutoBatchId,
  type AutoDelegationId,
  type AutoTreeId,
  type IsoDateTime,
  type PlanWithCount,
  type ProviderRunId,
  type SessionArtifact,
  type TurnEvent,
  type TurnState,
} from '@goodboy/types';
import { aPlanRow, aTree } from '../../../../../features/auto/testing/autoViewFixtures';
import type { AutoPendingRefusal, AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { sceneClock } from '../../sceneClock';
import { SESSION } from '../activityRunSeed';

const clock = sceneClock({ anchor: '2026-10-13T12:10:00.000Z' });

type AtParams = {
  readonly time: string;
};

const at = ({ time }: AtParams): IsoDateTime => clock.iso({ at: `2026-10-13T${time}.000Z` });
const ms = ({ time }: AtParams): number => clock.ms({ at: `2026-10-13T${time}.000Z` });

export const AUTO_SESSION = SESSION;

export const AUTO_ROOT_ID = brandId<AgentId>({ value: 'mock-auto-root' });
export const PLANNER_ID = brandId<AgentId>({ value: 'mock-auto-planner' });
const IMPLEMENTER_ID = brandId<AgentId>({ value: 'mock-auto-implementer' });
const TESTER_ID = brandId<AgentId>({ value: 'mock-auto-tester' });
const REVIEWER_ID = brandId<AgentId>({ value: 'mock-auto-reviewer' });
export const AUTO_PLAN_ID = brandId<ArtifactId>({ value: 'mock-auto-plan-retries' });

const RUN_ONE = brandId<ProviderRunId>({ value: 'mock-auto-run-1' });
const RUN_TWO = brandId<ProviderRunId>({ value: 'mock-auto-run-2' });
const RUN_THREE = brandId<ProviderRunId>({ value: 'mock-auto-run-3' });
const TREE_ID = brandId<AutoTreeId>({ value: 'mock-auto-tree' });

type LabelParams = {
  readonly label: string;
};

const modelKeyOf = ({ label }: LabelParams): string =>
  MODEL_CATALOGS.anthropic.find((model) => model.label === label)?.key ?? label;

const OPUS = modelKeyOf({ label: 'Opus 5.5' });
const SONNET = modelKeyOf({ label: 'Sonnet 5.5' });

export type AutoSceneState =
  'answering' | 'delegating' | 'plan' | 'working' | 'revising' | 'confirm' | 'refused' | 'done';

const GOAL_TEXT =
  'Why does the ledger retry post a second credit? Fix it and add a test for the retry path.';

const PLANNER_REASON =
  'Touches idempotency in payments-api and ledger-core, so it needs a plan before any edit.';
const IMPLEMENTER_REASON =
  'Mechanical change from an approved plan. It is the only agent that writes to payments-api.';
const TESTER_REASON = 'Adds and runs the retry tests from the plan. Starts after the Implementer.';
const REVIEWER_REASON =
  'Read only pass over the diff before you push, so a smaller model is enough.';

type DelegationParams = {
  readonly key: string;
  readonly childId: AgentId;
  readonly role: string;
  readonly state: AutoDelegation['state'];
  readonly batch: string;
  readonly reason: string;
  readonly model: string;
  readonly effort: string;
  readonly createdTime: string;
  readonly settledTime?: string;
  readonly outcome?: AutoDelegation['outcome'];
  readonly result?: unknown;
  readonly reviseBase?: number;
};

const delegationOf = ({
  key,
  childId,
  role,
  state,
  batch,
  reason,
  model,
  effort,
  createdTime,
  settledTime,
  outcome = null,
  result = null,
  reviseBase,
}: DelegationParams): AutoDelegation => ({
  id: brandId<AutoDelegationId>({ value: `mock-auto-delegation-${key}` }),
  treeId: TREE_ID,
  generation: 1,
  requestId: brandId({ value: `mock-auto-request-${batch}` }),
  requestHash: batch,
  batchId: brandId<AutoBatchId>({ value: batch }),
  slot: 0,
  childAgentId: childId,
  firstAttemptId: brandId({ value: `mock-auto-attempt-${key}` }),
  role,
  request: { task: `work for ${role}`, reason },
  target: { mountName: 'payments-api' },
  routing: {
    provider: 'anthropic',
    model,
    effort,
    reason: 'chosen for the role',
    proposal: 'kept',
  },
  state,
  outcome,
  reason: null,
  retryOf: null,
  reviseOf: reviseBase === undefined ? null : AUTO_PLAN_ID,
  baseRevision: reviseBase ?? null,
  isAdopted: false,
  isStopping: false,
  questionCycles: 0,
  deadlineAt: ms({ time: '12:40:00' }),
  result,
  createdAt: ms({ time: createdTime }),
  settledAt: settledTime === undefined ? null : ms({ time: settledTime }),
});

const PLANNER_RESULT = {
  declared: { summary: 'A three part plan: the key, the dedupe check and the retry test.' },
  artifacts: [{ id: AUTO_PLAN_ID, kind: 'plan', title: 'Retry-safe credit retries', revision: 1 }],
  cost: { usd: 0.12, basis: 'reported' },
};

const IMPLEMENTER_RESULT = {
  declared: { summary: 'The key is built once per credit, before the retry loop.' },
  verified: {
    changedFiles: [
      { path: 'postCredit.ts', ownership: 'attempt' },
      { path: 'applyCredit.ts', ownership: 'attempt' },
      { path: 'config.ts', ownership: 'attempt' },
    ],
    checks: [],
  },
  cost: { usd: 0.19, basis: 'reported' },
};

const TESTER_RESULT = {
  declared: { summary: 'Three tests added in payments-api, all pass.' },
  verified: {
    changedFiles: [{ path: 'retry.test.ts', ownership: 'attempt' }],
    checks: [
      { name: 'retries a timed out credit once', status: 'pass', source: 'harness' },
      { name: 'rejects a repeated key in applyCredit', status: 'pass', source: 'harness' },
      { name: 'keeps the balance after two attempts', status: 'pass', source: 'harness' },
    ],
  },
  cost: { usd: 0.07, basis: 'reported' },
};

const REVIEWER_RESULT = {
  declared: { summary: 'No blocking issues. 1 note.' },
  verified: { changedFiles: [], checks: [] },
  openQuestions: [{ questionId: 'q-note', text: 'Keep MAX_RETRY_ATTEMPTS in config.ts only.' }],
  cost: { usd: 0.04, basis: 'reported' },
};

const plannerDone = (): AutoDelegation =>
  delegationOf({
    key: 'planner',
    childId: PLANNER_ID,
    role: 'planner',
    state: 'settled',
    outcome: 'completed',
    batch: 'mock-auto-batch-1',
    reason: PLANNER_REASON,
    model: OPUS,
    effort: 'high',
    createdTime: '12:04:20',
    settledTime: '12:05:32',
    result: PLANNER_RESULT,
  });

type BatchTwoParams = {
  readonly implementerState: 'running' | 'settled';
};

const batchTwo = ({ implementerState }: BatchTwoParams): ReadonlyArray<AutoDelegation> => [
  delegationOf({
    key: 'implementer',
    childId: IMPLEMENTER_ID,
    role: 'implementer',
    state: implementerState,
    outcome: implementerState === 'settled' ? 'completed' : null,
    batch: 'mock-auto-batch-2',
    reason: IMPLEMENTER_REASON,
    model: SONNET,
    effort: 'medium',
    createdTime: '12:09:10',
    ...(implementerState === 'settled' && { settledTime: '12:11:54', result: IMPLEMENTER_RESULT }),
  }),
  delegationOf({
    key: 'tester',
    childId: TESTER_ID,
    role: 'tester',
    state: implementerState === 'settled' ? 'settled' : 'accepted',
    outcome: implementerState === 'settled' ? 'completed' : null,
    batch: 'mock-auto-batch-2',
    reason: TESTER_REASON,
    model: SONNET,
    effort: 'medium',
    createdTime: '12:09:10',
    ...(implementerState === 'settled' && { settledTime: '12:13:52', result: TESTER_RESULT }),
  }),
];

const reviewerDone = (): AutoDelegation =>
  delegationOf({
    key: 'reviewer',
    childId: REVIEWER_ID,
    role: 'reviewer',
    state: 'settled',
    outcome: 'completed',
    batch: 'mock-auto-batch-3',
    reason: REVIEWER_REASON,
    model: SONNET,
    effort: 'low',
    createdTime: '12:14:00',
    settledTime: '12:14:41',
    result: REVIEWER_RESULT,
  });

type ReviseParams = {
  readonly state: 'running' | 'awaiting_confirm';
};

const revise = ({ state }: ReviseParams): AutoDelegation =>
  delegationOf({
    key: 'planner-revise',
    childId: PLANNER_ID,
    role: 'planner',
    state,
    batch: 'mock-auto-batch-revise',
    reason: 'Rewrites plan v1 to cover two simultaneous webhooks.',
    model: OPUS,
    effort: 'high',
    createdTime: '12:07:00',
    reviseBase: 1,
  });

type PlanRowParams = {
  readonly approvalState: 'needs_approval' | 'approved' | 'revising';
  readonly revision: number;
  readonly approvedRevision: number | null;
  readonly openRevise: string | null;
};

const planRowOf = ({
  approvalState,
  revision,
  approvedRevision,
  openRevise,
}: PlanRowParams): AutoArtifactLedgerRow => {
  const row = aPlanRow({
    approvalState,
    revision,
    approvedRevision,
    openRevise,
    title: 'Retry-safe credit retries',
  });
  return { ...row, artifact: { ...row.artifact, artifactId: AUTO_PLAN_ID } };
};

export type AutoSceneData = Readonly<{
  view: AutoTreeView;
  agents: ReadonlyArray<Agent>;
  events: ReadonlyArray<TurnEvent>;
  rootTurn: TurnState;
  hasPlanArtifact: boolean;
}>;

type SceneAgentKind = 'auto' | 'planner' | 'implementer' | 'tester' | 'reviewer';

type SceneAgentParams = {
  readonly id: AgentId;
  readonly name: string;
  readonly kind: SceneAgentKind;
  readonly status: Agent['status'];
  readonly startTime: string;
  readonly endTime?: string;
  readonly parent?: AgentId;
};

const agentOf = ({
  id,
  name,
  kind,
  status,
  startTime,
  endTime,
  parent,
}: SceneAgentParams): Agent => ({
  id,
  sessionId: AUTO_SESSION.id,
  ordinal: 0,
  name,
  status,
  kind,
  startedAt: at({ time: startTime }),
  ...(endTime !== undefined && {
    completedAt: at({ time: endTime }),
    lastFinishedAt: at({ time: endTime }),
  }),
  ...(parent !== undefined && { parentAgentId: parent }),
  lastViewedAt: at({ time: '12:20:00' }),
});

type TextParams = {
  readonly time: string;
  readonly text: string;
  readonly run: ProviderRunId;
};

const userText = ({ time, text, run }: TextParams): TurnEvent => ({
  kind: 'user_text',
  runId: run,
  text,
  at: at({ time }),
});

const reply = ({ time, text, run }: TextParams): TurnEvent => ({
  kind: 'assistant_text',
  runId: run,
  delta: text,
  at: at({ time }),
});

const FIRST_REPLY =
  'This changes retry and ledger code, so I will not do it myself. A Planner goes first on Opus 5.5 because the change touches idempotency in two packages. Nothing is written until you approve its plan, then I start an Implementer and a Tester.';
const SECOND_REPLY =
  'The Planner finished with a 3 part plan. Approve it and I start the Implementer and the Tester. Ask for changes and the Planner revises it first.';
const THIRD_REPLY =
  'Plan approved. The Implementer starts now on Sonnet 5.5, since the plan is mechanical. The Tester is queued behind it: only one agent writes to payments-api at a time.';
const FINAL_REPLY =
  'Fixed. The retry loop built a new idempotency key on every attempt, so a credit that timed out after the ledger wrote it could post twice. The key is now built once per credit, before the loop, and applyCredit returns the first result for a key it has seen.';
const REFUSED_REPLY = 'I asked an implementer to commit the fix and open a draft PR.';
const ANSWER_REPLY =
  'Retries are posted by postCredit, which builds the idempotency key inside the retry loop. A new key on every attempt is why a credit that timed out after the ledger wrote it can post twice. Say the word and I fix it.';

type ViewParams = {
  readonly phase: AutoPhase;
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly artifacts: ReadonlyArray<AutoArtifactLedgerRow>;
  readonly spentUsd: number;
  readonly reservedUsd: number;
  readonly pendingRefusal?: AutoPendingRefusal | null;
};

const viewOf = ({
  phase,
  delegations,
  artifacts,
  spentUsd,
  reservedUsd,
  pendingRefusal = null,
}: ViewParams): AutoTreeView => ({
  pendingRefusal,
  tree: {
    ...aTree({ phase, capUsd: 10 }),
    id: TREE_ID,
    rootAgentId: AUTO_ROOT_ID,
    sessionId: AUTO_SESSION.id,
  },
  delegations,
  artifacts,
  budget: autoBudgetFacts({
    spend: autoTreeSpendOf({ capUsd: 10, settledUsd: spentUsd, reservedUsd, estimatedUsd: 0 }),
  }),
});

const IDLE: TurnState = { kind: 'idle', lastActivityAt: at({ time: '12:10:00' }) };

const PLAN_NEEDS = planRowOf({
  approvalState: 'needs_approval',
  revision: 1,
  approvedRevision: null,
  openRevise: null,
});
const PLAN_APPROVED = planRowOf({
  approvalState: 'approved',
  revision: 1,
  approvedRevision: 1,
  openRevise: null,
});

type SceneParams = {
  readonly state: AutoSceneState;
};

export const autoSceneOf = ({ state }: SceneParams): AutoSceneData => {
  const root = (status: Agent['status'], endTime?: string) =>
    agentOf({
      id: AUTO_ROOT_ID,
      name: 'Auto',
      kind: 'auto',
      status,
      startTime: '12:04:00',
      ...(endTime !== undefined && { endTime }),
    });
  const planner = (status: Agent['status']) =>
    agentOf({
      id: PLANNER_ID,
      name: 'Planner',
      kind: 'planner',
      status,
      startTime: '12:04:24',
      ...(status === 'completed' && { endTime: '12:05:32' }),
      parent: AUTO_ROOT_ID,
    });
  const first = [
    userText({ time: '12:04:00', text: GOAL_TEXT, run: RUN_ONE }),
    reply({ time: '12:04:05', text: FIRST_REPLY, run: RUN_ONE }),
  ];
  const second = [reply({ time: '12:05:40', text: SECOND_REPLY, run: RUN_TWO })];
  const approved = [
    userText({ time: '12:09:00', text: 'Approved plan v1.', run: RUN_THREE }),
    reply({ time: '12:09:05', text: THIRD_REPLY, run: RUN_THREE }),
  ];
  switch (state) {
    case 'answering':
      return {
        view: viewOf({
          phase: 'answering',
          delegations: [],
          artifacts: [],
          spentUsd: 0.03,
          reservedUsd: 0,
        }),
        agents: [root('completed', '12:04:30')],
        events: [
          userText({
            time: '12:04:00',
            text: 'Why does the ledger retry post a second credit?',
            run: RUN_ONE,
          }),
          reply({ time: '12:04:20', text: ANSWER_REPLY, run: RUN_ONE }),
        ],
        rootTurn: IDLE,
        hasPlanArtifact: false,
      };
    case 'delegating':
      return {
        view: viewOf({
          phase: 'delegating',
          delegations: [
            { ...plannerDone(), state: 'starting', outcome: null, result: null, settledAt: null },
          ],
          artifacts: [],
          spentUsd: 0.04,
          reservedUsd: 0.75,
        }),
        agents: [root('running'), planner('running')],
        events: first,
        rootTurn: { kind: 'running', runId: RUN_ONE, startedAt: at({ time: '12:04:00' }) },
        hasPlanArtifact: false,
      };
    case 'plan':
      return {
        view: viewOf({
          phase: 'waiting',
          delegations: [plannerDone()],
          artifacts: [PLAN_NEEDS],
          spentUsd: 0.18,
          reservedUsd: 0,
        }),
        agents: [root('completed', '12:05:50'), planner('completed')],
        events: [...first, ...second],
        rootTurn: IDLE,
        hasPlanArtifact: true,
      };
    case 'working':
      return {
        view: viewOf({
          phase: 'waiting',
          delegations: [plannerDone(), ...batchTwo({ implementerState: 'running' })],
          artifacts: [PLAN_APPROVED],
          spentUsd: 0.27,
          reservedUsd: 4.5,
        }),
        agents: [
          root('running'),
          planner('completed'),
          agentOf({
            id: IMPLEMENTER_ID,
            name: 'Implementer',
            kind: 'implementer',
            status: 'running',
            startTime: '12:09:16',
            parent: AUTO_ROOT_ID,
          }),
          agentOf({
            id: TESTER_ID,
            name: 'Tester',
            kind: 'tester',
            status: 'pending',
            startTime: '12:09:16',
            parent: AUTO_ROOT_ID,
          }),
        ],
        events: [...first, ...second, ...approved],
        rootTurn: { kind: 'running', runId: RUN_THREE, startedAt: at({ time: '12:09:00' }) },
        hasPlanArtifact: true,
      };
    case 'revising':
      return {
        view: viewOf({
          phase: 'waiting',
          delegations: [plannerDone(), revise({ state: 'running' })],
          artifacts: [
            planRowOf({
              approvalState: 'revising',
              revision: 1,
              approvedRevision: null,
              openRevise: 'mock-auto-delegation-planner-revise',
            }),
          ],
          spentUsd: 0.2,
          reservedUsd: 0.75,
        }),
        agents: [root('running'), planner('running')],
        events: [
          ...first,
          ...second,
          userText({
            time: '12:07:00',
            text: 'Cover two simultaneous webhooks for the same credit.',
            run: RUN_THREE,
          }),
        ],
        rootTurn: { kind: 'running', runId: RUN_THREE, startedAt: at({ time: '12:07:00' }) },
        hasPlanArtifact: true,
      };
    case 'confirm':
      return {
        view: viewOf({
          phase: 'waiting',
          delegations: [plannerDone(), revise({ state: 'awaiting_confirm' })],
          artifacts: [PLAN_NEEDS],
          spentUsd: 0.2,
          reservedUsd: 0.75,
        }),
        agents: [root('running'), planner('completed')],
        events: [
          ...first,
          ...second,
          userText({
            time: '12:07:00',
            text: 'Cover two simultaneous webhooks for the same credit.',
            run: RUN_THREE,
          }),
        ],
        rootTurn: { kind: 'running', runId: RUN_THREE, startedAt: at({ time: '12:07:00' }) },
        hasPlanArtifact: true,
      };
    case 'refused':
      return {
        view: viewOf({
          phase: 'merging',
          delegations: [],
          artifacts: [],
          spentUsd: 0.06,
          reservedUsd: 0,
          pendingRefusal: { action: 'delegate', code: 'mount_ambiguous', roles: ['implementer'] },
        }),
        agents: [root('completed', '12:04:30')],
        events: [
          userText({
            time: '12:04:00',
            text: 'Commit the retry fix and open a draft PR.',
            run: RUN_ONE,
          }),
          reply({ time: '12:04:20', text: REFUSED_REPLY, run: RUN_ONE }),
        ],
        rootTurn: IDLE,
        hasPlanArtifact: false,
      };
    case 'done':
      return {
        view: viewOf({
          phase: 'done',
          delegations: [
            plannerDone(),
            ...batchTwo({ implementerState: 'settled' }),
            reviewerDone(),
          ],
          artifacts: [PLAN_APPROVED],
          spentUsd: 0.53,
          reservedUsd: 0,
        }),
        agents: [
          root('completed', '12:15:30'),
          planner('completed'),
          agentOf({
            id: IMPLEMENTER_ID,
            name: 'Implementer',
            kind: 'implementer',
            status: 'completed',
            startTime: '12:09:16',
            endTime: '12:11:54',
            parent: AUTO_ROOT_ID,
          }),
          agentOf({
            id: TESTER_ID,
            name: 'Tester',
            kind: 'tester',
            status: 'completed',
            startTime: '12:11:56',
            endTime: '12:13:52',
            parent: AUTO_ROOT_ID,
          }),
          agentOf({
            id: REVIEWER_ID,
            name: 'Reviewer',
            kind: 'reviewer',
            status: 'completed',
            startTime: '12:14:00',
            endTime: '12:14:41',
            parent: AUTO_ROOT_ID,
          }),
        ],
        events: [
          ...first,
          ...second,
          ...approved,
          reply({ time: '12:14:50', text: FINAL_REPLY, run: RUN_THREE }),
        ],
        rootTurn: IDLE,
        hasPlanArtifact: true,
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

const PLAN_BODY = [
  '## Goal\n\nA retried credit must never post twice. Build the idempotency key once per credit, before the retry loop, and let applyCredit return the first result for a key it has already seen.',
  '## Approach\n\nTwo small edits in payments-api, then a test in the same package. The Implementer owns both edits, so they run as one step. The Tester starts after it, because only one agent writes to payments-api at a time. ledger-core stays read only.',
].join('\n\n');

export const AUTO_PLAN: PlanWithCount = {
  id: AUTO_PLAN_ID,
  sessionId: AUTO_SESSION.id,
  agentId: PLANNER_ID,
  title: 'Retry-safe credit retries',
  bodyMd: PLAN_BODY,
  status: 'active',
  clusters: [
    { title: 'Build the credit key once per retry in postCredit', instructions: 'Build the key.' },
    { title: 'Make applyCredit reject a repeated key', instructions: 'Return the first result.' },
    {
      title: 'Test the retry path with a timeout on the first attempt',
      instructions: 'Add tests.',
    },
  ],
  createdAt: at({ time: '12:05:30' }),
  updatedAt: at({ time: '12:05:30' }),
  consumptionCount: 0,
};

export const AUTO_PLAN_STORED: SessionArtifact = {
  id: AUTO_PLAN_ID,
  sessionId: AUTO_SESSION.id,
  agentId: PLANNER_ID,
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title: AUTO_PLAN.title,
  sourceFormat: 'markdown',
  sourceText: PLAN_BODY,
  metadata: { clusters: AUTO_PLAN.clusters },
  status: 'active',
  revision: 1,
  sourceTurnId: RUN_ONE,
  createdAt: at({ time: '12:05:30' }),
  updatedAt: at({ time: '12:05:30' }),
  openedAt: null,
};
