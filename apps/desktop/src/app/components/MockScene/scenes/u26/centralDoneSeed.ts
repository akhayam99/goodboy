import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type MeasuredTurnSpan,
  type ProviderRunId,
  type SessionEvent,
  type SessionEventId,
  type Step,
  type StepId,
  type TelemetryRecord,
  type TelemetryRecordId,
  type Workflow,
  type WorkflowId,
  type WorkflowRunId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../activityRunSeed';

export const DONE_SESSION_ID = SESSION_ID;

export const DONE_NOW = new Date(2026, 9, 18, 12, 0).getTime();

const WORKFLOW_ID = brandId<WorkflowId>({ value: 'mock-done-workflow-build' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'mock-done-run-build' });

type AtParams = {
  readonly day?: number;
  readonly hour: number;
  readonly minute?: number;
};

const at = ({ day = 18, hour, minute = 0 }: AtParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(2026, 9, day, hour, minute).toISOString() });

const msOf = ({ day = 18, hour, minute = 0 }: AtParams): number =>
  new Date(2026, 9, day, hour, minute).getTime();

const STEP_NAMES = ['Scope', 'Tests first', 'Implement', 'Review', 'Update docs', 'Push'];

type IndexParams = {
  readonly index: number;
};

type KeyParams = {
  readonly key: string;
};

const stepId = ({ index }: IndexParams): StepId =>
  brandId<StepId>({ value: `mock-done-step-${index}` });

const STEPS: ReadonlyArray<Step> = STEP_NAMES.map((name, offset) => ({
  id: stepId({ index: offset + 1 }),
  workflowId: WORKFLOW_ID,
  ordinal: offset,
  name: `Step ${offset + 1} ${name}`,
  promptPrefix: '',
}));

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: SESSION.workspaceId,
  name: 'Build',
  description: 'Scope, test, implement, review, document and push.',
  origin: 'library',
  steps: STEPS,
  createdAt: at({ day: 16, hour: 9 }),
  updatedAt: at({ day: 16, hour: 9 }),
};

const runIdOf = ({ key }: KeyParams): ProviderRunId =>
  brandId<ProviderRunId>({ value: `mock-done-provider-run-${key}` });

const agentId = ({ key }: KeyParams): AgentId =>
  brandId<AgentId>({ value: `mock-done-agent-${key}` });

const AGENTS: ReadonlyArray<Agent> = [
  {
    id: agentId({ key: 'step-1' }),
    sessionId: SESSION_ID,
    stepId: stepId({ index: 1 }),
    workflowRunId: RUN_ID,
    ordinal: 1,
    name: 'Scope the change',
    kind: 'scout',
    status: 'completed',
    runId: runIdOf({ key: 'step-1' }),
    outputSummary: 'Mapped the payout limits in payments-api.',
    startedAt: at({ hour: 9, minute: 50 }),
    completedAt: at({ hour: 9, minute: 55 }),
  },
  {
    id: agentId({ key: 'step-2' }),
    sessionId: SESSION_ID,
    stepId: stepId({ index: 2 }),
    workflowRunId: RUN_ID,
    ordinal: 2,
    name: 'Write the tests first',
    kind: 'tester',
    status: 'completed',
    runId: runIdOf({ key: 'step-2' }),
    outputSummary: 'Scoped the change and wrote the tests first. Two of them fail on purpose.',
    startedAt: at({ hour: 10, minute: 10 }),
    completedAt: at({ hour: 10, minute: 19 }),
  },
  {
    id: agentId({ key: 'step-3' }),
    sessionId: SESSION_ID,
    stepId: stepId({ index: 3 }),
    workflowRunId: RUN_ID,
    ordinal: 3,
    name: 'Implement the limits',
    kind: 'implementer',
    status: 'pending',
  },
  {
    id: agentId({ key: 'scribe' }),
    sessionId: SESSION_ID,
    ordinal: 4,
    name: 'Summarise the plan',
    kind: 'scribe',
    status: 'completed',
    runId: runIdOf({ key: 'scribe' }),
    startedAt: at({ hour: 9, minute: 38 }),
    completedAt: at({ hour: 9, minute: 40 }),
  },
  {
    id: agentId({ key: 'planner' }),
    sessionId: SESSION_ID,
    ordinal: 5,
    name: 'Plan the payout limits',
    kind: 'planner',
    status: 'completed',
    runId: runIdOf({ key: 'planner' }),
    startedAt: at({ day: 16, hour: 15, minute: 2 }),
    completedAt: at({ day: 16, hour: 16, minute: 20 }),
  },
];

type EventParams = {
  readonly key: string;
  readonly kind: SessionEvent['kind'];
  readonly payload: SessionEvent['payload'];
  readonly createdAt: IsoDateTime;
};

const eventOf = ({ key, kind, payload, createdAt }: EventParams): SessionEvent => ({
  id: brandId<SessionEventId>({ value: `mock-done-event-${key}` }),
  sessionId: SESSION_ID,
  kind,
  payload,
  createdAt,
});

const EVENTS: ReadonlyArray<SessionEvent> = [
  eventOf({
    key: 'rebase-asked',
    kind: 'rebase_requested',
    payload: { branch: 'main', projectName: 'payments-api' },
    createdAt: at({ hour: 9, minute: 4 }),
  }),
  eventOf({
    key: 'rebase-done',
    kind: 'history_rewritten',
    payload: {
      origin: 'rebase',
      branch: 'hl/fix-webhook-idempotency',
      projectName: 'payments-api',
    },
    createdAt: at({ hour: 9, minute: 12 }),
  }),
  eventOf({
    key: 'decisions',
    kind: 'decisions_changed',
    payload: { added: 2 },
    createdAt: at({ hour: 9, minute: 45 }),
  }),
  eventOf({
    key: 'pr',
    kind: 'pr_created',
    payload: { number: 309 },
    createdAt: at({ day: 16, hour: 16, minute: 25 }),
  }),
];

type SpanParams = {
  readonly key: string;
  readonly day?: number;
  readonly from: AtParams;
  readonly to: AtParams;
  readonly model: string;
  readonly effort: string;
  readonly runId: WorkflowRunId | null;
};

const spanOf = ({ key, day, from, to, model, effort, runId }: SpanParams): MeasuredTurnSpan => ({
  agentId: agentId({ key }),
  parentAgentId: null,
  agentStatus: 'completed',
  workflowRunId: runId,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider: 'anthropic',
  model,
  effort,
  startedAtMs: msOf({ ...from, day }),
  endedAtMs: msOf({ ...to, day }),
  endReason: 'succeeded',
  costUsd: null,
  touchedMountIds: null,
});

const SPANS: ReadonlyArray<MeasuredTurnSpan> = [
  spanOf({
    key: 'step-1',
    from: { hour: 9, minute: 50 },
    to: { hour: 9, minute: 55 },
    model: 'claude-sonnet-5-5',
    effort: 'medium',
    runId: RUN_ID,
  }),
  spanOf({
    key: 'step-2',
    from: { hour: 10, minute: 10 },
    to: { hour: 10, minute: 19 },
    model: 'claude-sonnet-5-5',
    effort: 'medium',
    runId: RUN_ID,
  }),
  spanOf({
    key: 'scribe',
    from: { hour: 9, minute: 38 },
    to: { hour: 9, minute: 40 },
    model: 'claude-sonnet-5-5',
    effort: 'low',
    runId: null,
  }),
  spanOf({
    key: 'planner',
    day: 16,
    from: { hour: 15, minute: 2 },
    to: { hour: 16, minute: 20 },
    model: 'claude-opus-5-5',
    effort: 'high',
    runId: null,
  }),
];

type CostParams = {
  readonly key: string;
  readonly usd: number;
};

const costOf = ({ key, usd }: CostParams): TelemetryRecord => ({
  id: brandId<TelemetryRecordId>({ value: `mock-done-telemetry-${key}` }),
  runId: runIdOf({ key }),
  sessionId: SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  recordedAt: at({ hour: 10 }),
  inputTokens: 8_000,
  outputTokens: 1_200,
  estimatedCostUsd: usd,
});

export const seedCentralDone = () => {
  seedActivityRunScene();
  useAppStore.setState({
    sessions: [
      {
        ...SESSION,
        state: { kind: 'idle', lastActivityAt: at({ hour: 10, minute: 20 }) },
        workflowRuns: [
          {
            id: RUN_ID,
            workflowId: WORKFLOW_ID,
            ordinal: 0,
            currentStep: 2,
            autoRun: false,
            triggerMode: 'immediate',
            executionMode: 'static',
            goal: SESSION.goal,
            createdAt: at({ day: 16, hour: 9 }),
          },
        ],
      },
    ],
    sessionPhaseRuns: { [SESSION_ID]: AGENTS },
    sessionWorkflows: { [SESSION_ID]: [WORKFLOW] },
    phaseTemplates: { [SESSION.workspaceId]: [WORKFLOW] },
    sessionEvents: { [SESSION_ID]: EVENTS },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    sessionAnsweredQuestions: { [SESSION_ID]: [] },
    sessionArtifacts: { [SESSION_ID]: [] },
    sessionPlans: { [SESSION_ID]: [] },
    sessionContextItems: { [SESSION_ID]: [] },
    sessionWorktreeRecords: { [SESSION_ID]: [] },
    sessionExternalTasks: { [SESSION_ID]: [] },
    agentTurnState: {},
    sessionTurnSpans: { [SESSION_ID]: SPANS },
    sessionTelemetry: {
      [SESSION_ID]: [
        costOf({ key: 'step-1', usd: 0.21 }),
        costOf({ key: 'step-2', usd: 0.34 }),
        costOf({ key: 'scribe', usd: 0.04 }),
      ],
    },
  });
};

type BatchBranch = {
  readonly project: string;
  readonly branch: string;
  readonly pr: number | null;
};

const BATCH_BRANCHES: ReadonlyArray<BatchBranch> = [
  { project: 'payments-api', branch: 'hl/fix-webhook-idempotency', pr: 309 },
  { project: 'payments-api', branch: 'hl/payout-limits', pr: 311 },
  { project: 'payments-api', branch: 'hl/refund-audit', pr: null },
  { project: 'ledger-core', branch: 'hl/ledger-export', pr: 142 },
  { project: 'ledger-core', branch: 'hl/postings-index', pr: null },
  { project: 'ledger-core', branch: 'hl/period-close', pr: null },
  { project: 'notify-relay', branch: 'hl/relay-retries', pr: null },
  { project: 'notify-relay', branch: 'hl/template-cache', pr: null },
  { project: 'notify-relay', branch: 'hl/digest-schedule', pr: null },
];

type BatchAtParams = {
  readonly index: number;
  readonly second: number;
};

const batchAt = ({ index, second }: BatchAtParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(2026, 9, 18, 9, 6 + index, second).toISOString() });

const BATCH_EVENTS: ReadonlyArray<SessionEvent> = BATCH_BRANCHES.flatMap((entry, index) => {
  const payload = {
    origin: 'rebase' as const,
    branch: entry.branch,
    mountId: `mock-done-mount-${index}`,
    projectName: entry.project,
    batchId: 'mock-done-batch',
  };
  return [
    eventOf({
      key: `batch-rewrite-${index}`,
      kind: 'history_rewritten',
      payload,
      createdAt: batchAt({ index, second: 0 }),
    }),
    eventOf({
      key: `batch-push-${index}`,
      kind: 'history_pushed',
      payload: { ...payload, ...(entry.pr === null ? {} : { prNumber: entry.pr }) },
      createdAt: batchAt({ index, second: 30 }),
    }),
  ];
});

export const DONE_BATCH_ROW_ID = 'batch:rebase:mock-done-batch';

export const DONE_CHAIN_ROW_ID = 'agent:mock-done-agent-chain';

const DONE_CHAIN_SUMMARY = 'apply fix -> verify tsc -> lint -> ready for push';

const RECAP_AGENTS: ReadonlyArray<Agent> = [
  {
    id: agentId({ key: 'recap' }),
    sessionId: SESSION_ID,
    ordinal: 6,
    name: 'Batch the row reads',
    kind: 'implementer',
    status: 'completed',
    runId: runIdOf({ key: 'recap' }),
    outputSummary: JSON.stringify({
      done: ['Batched the row reads in payments-api', 'Wrote the before and after numbers'],
      left: [{ text: 'Stream rows to CSV', role: 'implementer' }],
    }),
    startedAt: at({ hour: 11, minute: 0 }),
    completedAt: at({ hour: 11, minute: 20 }),
  },
  {
    id: agentId({ key: 'chain' }),
    sessionId: SESSION_ID,
    ordinal: 7,
    name: 'Fix the lint check',
    kind: 'implementer',
    status: 'completed',
    runId: runIdOf({ key: 'chain' }),
    outputSummary: DONE_CHAIN_SUMMARY,
    startedAt: at({ hour: 11, minute: 25 }),
    completedAt: at({ hour: 11, minute: 40 }),
  },
];

export const seedCentralDoneRecap = () => {
  useAppStore.setState({ sessionPhaseRuns: { [SESSION_ID]: [...AGENTS, ...RECAP_AGENTS] } });
};

export const seedCentralDoneBatch = () => {
  useAppStore.setState({
    sessionEvents: {
      [SESSION_ID]: [
        ...EVENTS.filter((event) => event.id !== 'mock-done-event-rebase-done'),
        ...BATCH_EVENTS,
      ],
    },
  });
};

export { SESSION as DONE_SESSION };
