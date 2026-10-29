import { MODEL_CATALOGS, autoBudgetOf, autoTreeSpendOf } from '@goodboy/core';
import type { AutoDelegation, AutoOutcome } from '@goodboy/db';
import {
  brandId,
  type Agent,
  type AgentId,
  type AutoBatchId,
  type AutoDelegationId,
  type IsoDateTime,
  type ProviderRunId,
  type TurnEvent,
} from '@goodboy/types';
import { anArtifactRow, aTree } from '../../../../../features/auto/testing/autoViewFixtures';
import type {
  AutoDeliveredArtifact,
  AutoDeliveredResult,
  AutoTreeView,
} from '../../../../../store/slices/auto-view/state';
import { sceneClock } from '../../sceneClock';
import { SESSION } from '../activityRunSeed';

const clock = sceneClock({ anchor: '2026-10-17T10:20:00.000Z' });

type AtParams = {
  readonly time: string;
};

const at = ({ time }: AtParams): IsoDateTime => clock.iso({ at: `2026-10-17T${time}.000Z` });
const ms = ({ time }: AtParams): number => clock.ms({ at: `2026-10-17T${time}.000Z` });

export const RESULTS_SESSION = SESSION;
export const RESULTS_ROOT_ID = brandId<AgentId>({ value: 'mock-results-auto' });
const FIRST_REVIEWER = brandId<AgentId>({ value: 'mock-results-reviewer-1' });
const SECOND_REVIEWER = brandId<AgentId>({ value: 'mock-results-reviewer-2' });
const TESTER = brandId<AgentId>({ value: 'mock-results-tester' });
const RUN_ONE = brandId<ProviderRunId>({ value: 'mock-results-run-1' });
const RUN_TWO = brandId<ProviderRunId>({ value: 'mock-results-run-2' });
const BATCH = brandId<AutoBatchId>({ value: 'mock-results-batch' });

type LabelParams = {
  readonly label: string;
};

const modelKeyOf = ({ label }: LabelParams): string =>
  MODEL_CATALOGS.anthropic.find((model) => model.label === label)?.key ?? label;

const SONNET = modelKeyOf({ label: 'Sonnet 5.5' });
const OPUS = modelKeyOf({ label: 'Opus 5.5' });

const FIRST_REPORT =
  'No blocking issues in payments-api. The idempotency key is now built once per credit, before the retry loop, and postCredit passes it through unchanged.';
const SECOND_REPORT = [
  'Comparing the ledger-core branch against main.',
  '',
  'Checking how applyCredit builds the idempotency key.',
  '',
  'Reviewing the insert path for concurrent webhooks.',
  '',
  'One race in ledger-core.',
  '',
  'applyCredit reads the key and inserts the credit in two statements, so two webhooks for the same event can both pass the check and both insert a row.',
  '',
  'Fix: insert with the key under a unique index and return the first row on conflict.',
  '',
  'Everything else in the diff reads fine.',
].join('\n');

const REPORT_ID = 'mock-results-report-ledger-core';
const REPORT_TITLE = 'Certify the ledger-core retry fix, branch vs main';
const REPORT_SOURCE = [
  '<<summary>>',
  'One race left in ledger-core: applyCredit can insert the same credit twice when two webhooks arrive together. Everything else in the diff is fine to merge.',
  '<</summary>>',
  '',
  '## Findings',
  '',
  'applyCredit reads the key and inserts in two statements.',
].join('\n');

const REPORT: AutoDeliveredArtifact = {
  artifactId: REPORT_ID,
  kind: 'report',
  title: REPORT_TITLE,
  revision: 1,
};

type ChildParams = {
  readonly key: string;
  readonly childId: AgentId;
  readonly role: string;
  readonly task: string;
  readonly model: string;
  readonly outcome: AutoOutcome;
  readonly slot: number;
  readonly artifacts: ReadonlyArray<AutoDeliveredArtifact>;
};

const delegationOf = ({
  key,
  childId,
  role,
  task,
  model,
  outcome,
  slot,
}: ChildParams): AutoDelegation => ({
  id: brandId<AutoDelegationId>({ value: `mock-results-delegation-${key}` }),
  treeId: aTree().id,
  generation: 1,
  requestId: brandId({ value: 'mock-results-request' }),
  requestHash: 'mock-results-request',
  batchId: BATCH,
  slot,
  childAgentId: childId,
  firstAttemptId: brandId({ value: `mock-results-attempt-${key}` }),
  role,
  request: { task, reason: 'Read only pass before you push.' },
  target: { mountName: 'payments-api' },
  routing: { provider: 'anthropic', model, effort: 'medium', reason: 'chosen for the role' },
  state: 'settled',
  outcome,
  reason: outcome === 'failed' ? 'process_error' : null,
  retryOf: null,
  reviseOf: null,
  baseRevision: null,
  isAdopted: false,
  isStopping: false,
  questionCycles: 0,
  deadlineAt: ms({ time: '10:40:00' }),
  result: null,
  createdAt: ms({ time: '10:05:10' }) + slot,
  settledAt: ms({ time: '10:11:30' }),
});

const CHILDREN: ReadonlyArray<ChildParams & Readonly<{ summary: string | null }>> = [
  {
    key: 'reviewer-1',
    childId: FIRST_REVIEWER,
    role: 'reviewer',
    task: 'Review the retry fix in payments-api.',
    model: SONNET,
    outcome: 'completed',
    slot: 0,
    artifacts: [],
    summary: FIRST_REPORT,
  },
  {
    key: 'reviewer-2',
    childId: SECOND_REVIEWER,
    role: 'reviewer',
    task: 'Review the ledger-core side of the retry fix.',
    model: OPUS,
    outcome: 'completed',
    slot: 1,
    artifacts: [REPORT],
    summary: SECOND_REPORT,
  },
  {
    key: 'tester',
    childId: TESTER,
    role: 'tester',
    task: 'Run the retry tests in payments-api.',
    model: SONNET,
    outcome: 'failed',
    slot: 2,
    artifacts: [],
    summary: null,
  },
];

const deliveredOf = (child: (typeof CHILDREN)[number]): AutoDeliveredResult => ({
  runId: RUN_TWO,
  delegationId: `mock-results-delegation-${child.key}`,
  childAgentId: child.childId,
  role: child.role,
  provider: 'anthropic',
  model: child.model,
  outcome: child.outcome,
  summary: child.summary,
  artifacts: child.artifacts,
});

export const RESULTS_VIEW: AutoTreeView = {
  tree: {
    ...aTree({ phase: 'done', capUsd: 10 }),
    rootAgentId: RESULTS_ROOT_ID,
    sessionId: RESULTS_SESSION.id,
  },
  delegations: CHILDREN.map((child) => delegationOf(child)),
  artifacts: [
    anArtifactRow({
      id: REPORT_ID,
      kind: 'report',
      title: REPORT_TITLE,
      sourceText: REPORT_SOURCE,
    }),
  ],
  budget: autoBudgetOf({
    spend: autoTreeSpendOf({
      capUsd: 10,
      settledUsd: 0.41,
      liveUsd: 0,
      reservedUsd: 0,
      estimatedUsd: 0,
    }),
  }),
  pendingRefusal: null,
  deliveredResults: CHILDREN.map((child) => deliveredOf(child)),
  hiddenChildIds: [],
  rootAsk: null,
};

type AgentParams = {
  readonly id: AgentId;
  readonly name: string;
  readonly kind: 'auto' | 'reviewer' | 'tester';
  readonly status: Agent['status'];
};

const agentOf = ({ id, name, kind, status }: AgentParams): Agent => ({
  id,
  sessionId: RESULTS_SESSION.id,
  ordinal: 0,
  name,
  status,
  kind,
  startedAt: at({ time: '10:05:00' }),
  completedAt: at({ time: '10:11:30' }),
  lastFinishedAt: at({ time: '10:11:30' }),
  ...(id !== RESULTS_ROOT_ID && { parentAgentId: RESULTS_ROOT_ID }),
  lastViewedAt: at({ time: '10:19:00' }),
});

export const RESULTS_AGENTS: ReadonlyArray<Agent> = [
  agentOf({ id: RESULTS_ROOT_ID, name: 'Auto', kind: 'auto', status: 'completed' }),
  agentOf({ id: FIRST_REVIEWER, name: 'Reviewer', kind: 'reviewer', status: 'completed' }),
  agentOf({ id: SECOND_REVIEWER, name: 'Reviewer', kind: 'reviewer', status: 'completed' }),
  agentOf({ id: TESTER, name: 'Tester', kind: 'tester', status: 'failed' }),
];

const DELIVERY_TEXT = [
  'RESULTS FROM YOUR AGENTS',
  'Results of batch mock-results-batch:',
  `- Review the retry fix in payments-api (reviewer ${FIRST_REVIEWER}): completed`,
  `- Review the ledger-core side of the retry fix (reviewer ${SECOND_REVIEWER}): completed`,
  `- Run the retry tests in payments-api (tester ${TESTER}): failed, process_error`,
].join('\n');

const SYNTHESIS =
  'Both reviews agree the retry fix is right in payments-api. The ledger-core review found one race left, so I would hand that to an Implementer. The retry tests ended with an error before they ran anything, so the retry path is still untested. Should I start the Implementer for the race and run the tests again?';

export const RESULTS_EVENTS: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: RUN_ONE,
    text: 'Review the retry fix before I push, and run its tests.',
    at: at({ time: '10:05:00' }),
  },
  {
    kind: 'assistant_text',
    runId: RUN_ONE,
    delta:
      'I asked two reviewers to read each side of the fix and a tester to run the retry tests.',
    at: at({ time: '10:05:08' }),
  },
  {
    kind: 'user_text',
    runId: RUN_TWO,
    text: DELIVERY_TEXT,
    deliveredBy: 'auto',
    at: at({ time: '10:11:40' }),
  },
  { kind: 'assistant_text', runId: RUN_TWO, delta: SYNTHESIS, at: at({ time: '10:11:52' }) },
];

export const RESULTS_IDLE_AT = at({ time: '10:12:00' });
