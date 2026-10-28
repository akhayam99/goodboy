import {
  DEFAULT_WORKFLOW_RULES,
  type Agent,
  type AgentId,
  type OrchestratorHint,
  type ProviderRunId,
  type Session,
  type SessionId,
  type Step,
  type StepId,
  type TelemetryRecord,
  type TelemetryRecordId,
  type TurnEvent,
  type TurnState,
  type RunRoute,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-16T15:12:00.000Z' });

const at = (minute: string) => clock.iso({ at: `2026-10-16T15:${minute}.000Z` });

const C09_NOW = at('12:00');

const idOf = <T>(value: string): T => JSON.parse(JSON.stringify(value));

export const C09_WORKSPACE_ID = idOf<WorkspaceId>('mock-c09-workspace');
export const C09_SESSION_ID = idOf<SessionId>('mock-c09-session');
export const C09_RUN_ID = idOf<WorkflowRunId>('mock-c09-run');
const WORKFLOW_ID = idOf<WorkflowId>('mock-c09-workflow');
const PRESET_WORKFLOW_ID = idOf<WorkflowId>('mock-c09-workflow-preset');
const PRESET_RUN_ID = idOf<WorkflowRunId>('mock-c09-run-preset');
const SCOUT_STEP = idOf<StepId>('mock-c09-step-scout');
const IMPLEMENT_STEP = idOf<StepId>('mock-c09-step-implement');
const TEST_STEP = idOf<StepId>('mock-c09-step-test');
const DOCS_STEP = idOf<StepId>('mock-c09-step-docs');
const PRESET_STEP = idOf<StepId>('mock-c09-step-preset');
const C09_SCOUT_ID = idOf<AgentId>('mock-c09-scout');
export const C09_IMPLEMENTER_ID = idOf<AgentId>('mock-c09-implementer');
export const C09_TESTER_ID = idOf<AgentId>('mock-c09-tester');
const FIXTURE_ID = idOf<AgentId>('mock-c09-tester-fixture');
const BENCH_ID = idOf<AgentId>('mock-c09-tester-bench');
const DOCS_ID = idOf<AgentId>('mock-c09-docs');
const PRESET_AGENT_ID = idOf<AgentId>('mock-c09-preset');
const SCOUT_RUN = idOf<ProviderRunId>('mock-c09-provider-scout');
const IMPLEMENT_RUN = idOf<ProviderRunId>('mock-c09-provider-implement');
const TEST_RUN = idOf<ProviderRunId>('mock-c09-provider-test');
const DOCS_RUN = idOf<ProviderRunId>('mock-c09-provider-docs');

export type C09State =
  'running' | 'reading' | 'ready' | 'failed' | 'done' | 'archived' | 'step-blocked' | 'blocked';

export type C09Page = 'document' | 'list' | 'empty' | 'step';

type SeedParams = {
  readonly state: C09State;
  readonly page: C09Page;
  readonly isGuidanceRepeated?: boolean;
  readonly isRouted?: boolean;
};

const STANDING_GUIDANCE = 'Keep every change behind the existing export flag.';

type StateParams = {
  readonly state: C09State;
};

type StepParams = {
  readonly id: StepId;
  readonly ordinal: number;
  readonly name: string;
  readonly role: Step['role'];
  readonly reason: string;
};

const stepOf = ({ id, ordinal, name, role, reason }: StepParams): Step => ({
  id,
  workflowId: WORKFLOW_ID,
  ordinal,
  name,
  role,
  promptPrefix: '',
  orchestratorReason: reason,
});

const SCOUT = stepOf({
  id: SCOUT_STEP,
  ordinal: 0,
  name: 'Find where the export spends its time',
  role: 'scout',
  reason: 'Nobody knows yet where the 10k row export loses its time, so look before changing code.',
});

const IMPLEMENT = stepOf({
  id: IMPLEMENT_STEP,
  ordinal: 1,
  name: 'Batch the row reads',
  role: 'implementer',
  reason: 'The scout found one query per row. Batching the reads is the change with the most gain.',
});

const TEST = stepOf({
  id: TEST_STEP,
  ordinal: 2,
  name: 'Run the 12k export benchmark',
  role: 'tester',
  reason: 'The batching must be proven on 12,000 rows before any CSV work.',
});

const DOCS = stepOf({
  id: DOCS_STEP,
  ordinal: 3,
  name: 'Write the export notes',
  role: 'docs',
  reason: 'You asked for the numbers in the notes, so the docs step writes them down.',
});

const isFinished = ({ state }: StateParams): boolean => state === 'done' || state === 'archived';

type WorkflowParams = StateParams & {
  readonly isGuidanceRepeated: boolean;
};

const workflowOf = ({ state, isGuidanceRepeated }: WorkflowParams): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: C09_WORKSPACE_ID,
  name: 'Speed up the export end to end',
  description: '',
  origin: 'orchestrated',
  processText: isGuidanceRepeated
    ? STANDING_GUIDANCE
    : 'Prefer small steps. Measure before and after every change.',
  steps: isFinished({ state }) ? [SCOUT, IMPLEMENT, TEST, DOCS] : [SCOUT, IMPLEMENT, TEST],
  createdAt: at('00:00'),
  updatedAt: at('00:00'),
});

const PRESET_WORKFLOW: Workflow = {
  id: PRESET_WORKFLOW_ID,
  workspaceId: C09_WORKSPACE_ID,
  name: 'Fix flaky tests',
  description: '',
  isPreset: true,
  origin: 'library',
  steps: [
    {
      id: PRESET_STEP,
      workflowId: PRESET_WORKFLOW_ID,
      ordinal: 0,
      name: 'Find the flaky tests',
      role: 'scout',
      promptPrefix: '',
    },
  ],
  createdAt: at('00:00'),
  updatedAt: at('00:00'),
};

const QUEUED_HINT: OrchestratorHint = {
  id: 'mock-c09-hint-csv',
  text: 'Keep the CSV columns in the same order as today.',
  createdAt: at('10:40'),
};

const READ_HINT: OrchestratorHint = {
  id: 'mock-c09-hint-notes',
  text: 'Put the before and after numbers in the export notes.',
  createdAt: at('06:30'),
  consumedAt: at('08:00'),
  consumedAtStep: 3,
};

const hintsOf = ({ state }: StateParams): ReadonlyArray<OrchestratorHint> => {
  if (isFinished({ state })) {
    return [READ_HINT, { ...QUEUED_HINT, consumedAt: at('11:00'), consumedAtStep: 4 }];
  }
  return state === 'failed' ? [READ_HINT] : [READ_HINT, QUEUED_HINT];
};

const SUMMARY_RUNNING = JSON.stringify({
  done: ['Found one query per row in the export', 'Batched the row reads in payments-api'],
  left: [
    { text: 'Prove the batching on 12,000 rows', role: 'tester' },
    { text: 'Stream rows to CSV', role: 'implementer' },
  ],
});

const SUMMARY_BLOCKED = JSON.stringify({
  done: ['Found one query per row in the export', 'Batched the row reads in payments-api'],
  left: [
    'Run the export benchmark on 12k rows',
    { text: 'Write the export notes', role: 'docs' },
    'Stream rows to CSV',
  ],
});

const BLOCKED_REASON =
  '**Needs a human call.** The export notes must name a teammate.\n\n- Ask them to confirm the `payments-api` numbers\n- Then continue';

const SUMMARY_DONE = JSON.stringify({
  done: [
    'Found one query per row in the export',
    'Batched the row reads in payments-api',
    'Proved 12,000 rows export in 4.1s, down from 38s',
    'Wrote the before and after numbers in the export notes',
  ],
  left: ['Stream rows to CSV, a follow up'],
});

const stopOf = ({ state }: StateParams): Pick<WorkflowRun, 'orchestrationStop'> =>
  state === 'failed'
    ? {
        orchestrationStop: { kind: 'failure', message: 'the orchestrator returned no step.' },
      }
    : {};

const outcomeOf = ({ state }: StateParams): Partial<WorkflowRun> =>
  state === 'blocked'
    ? { orchestrationOutcome: 'blocked', orchestrationReason: BLOCKED_REASON }
    : isFinished({ state })
      ? {
          orchestrationOutcome: 'done',
          orchestrationReason:
            'The export takes 4.1s on 12,000 rows and the notes hold the numbers. Streaming to CSV is a separate change.',
        }
      : {};

const summaryOf = ({ state }: StateParams): string => {
  if (isFinished({ state })) {
    return SUMMARY_DONE;
  }
  return state === 'step-blocked' || state === 'blocked' ? SUMMARY_BLOCKED : SUMMARY_RUNNING;
};

type RunParams = StateParams & {
  readonly isRouted: boolean;
};

const ORCHESTRATED_ROUTE: RunRoute = {
  shape: 'plan',
  row: 1,
  presetName: null,
  closeness: null,
  role: null,
  choice: 'Workflow \u00b7 Orchestrated',
  why: 'you picked it',
};

const runOf = ({ state, isRouted }: RunParams): WorkflowRun => ({
  id: C09_RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 2,
  currentStep: 2,
  autoRun: state !== 'ready',
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  title: 'Speed up the export end to end',
  goal: 'The ledger export times out over 10k rows. Make a 12,000 row export finish in under 5 seconds without changing the CSV it writes.',
  createdAt: at('01:00'),
  spendLimitUsd: 3,
  spendLimitMode: 'pause',
  providerPool: ['anthropic', 'codex'],
  rulesSnapshot: {
    ...DEFAULT_WORKFLOW_RULES,
    autonomy: state === 'ready' ? 'step' : 'plan',
    standingGuidance: STANDING_GUIDANCE,
    ...(isRouted ? { route: ORCHESTRATED_ROUTE } : {}),
  },
  orchestratorHints: hintsOf({ state }),
  orchestratorSummary: summaryOf({ state }),
  ...stopOf({ state }),
  ...outcomeOf({ state }),
  ...(state === 'archived' ? { discardedAt: at('11:30') } : {}),
});

const PRESET_RUN: WorkflowRun = {
  id: PRESET_RUN_ID,
  workflowId: PRESET_WORKFLOW_ID,
  ordinal: 1,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  title: 'Fix flaky tests in the ledger export',
  createdAt: at('00:10'),
};

type AgentParams = {
  readonly id: AgentId;
  readonly runId: WorkflowRunId;
  readonly stepId: StepId;
  readonly ordinal: number;
  readonly name: string;
  readonly kind: string;
  readonly status: Agent['status'];
  readonly startedMinute?: string;
  readonly completedMinute?: string;
  readonly parentAgentId?: AgentId;
};

const agentOf = ({
  id,
  runId,
  stepId,
  ordinal,
  name,
  kind,
  status,
  startedMinute,
  completedMinute,
  parentAgentId,
}: AgentParams): Agent => ({
  id,
  sessionId: C09_SESSION_ID,
  workflowRunId: runId,
  stepId,
  ordinal,
  name,
  kind,
  status,
  providerOverride: 'anthropic',
  modelOverride: 'claude-sonnet-5-5',
  effort: 'high',
  ...(parentAgentId === undefined ? {} : { parentAgentId }),
  ...(startedMinute === undefined ? {} : { startedAt: at(startedMinute) }),
  ...(completedMinute === undefined ? {} : { completedAt: at(completedMinute) }),
});

const testerStatusOf = ({ state }: StateParams): Agent['status'] => {
  if (state === 'running') {
    return 'running';
  }
  if (state === 'reading') {
    return 'skipped';
  }
  if (state === 'step-blocked') {
    return 'blocked';
  }
  return 'completed';
};

const agentsOf = ({ state }: StateParams): ReadonlyArray<Agent> => {
  const isReady = state === 'ready';
  const testerStatus = testerStatusOf({ state });
  const steps: ReadonlyArray<Agent> = [
    agentOf({
      id: C09_SCOUT_ID,
      runId: C09_RUN_ID,
      stepId: SCOUT_STEP,
      ordinal: 0,
      name: SCOUT.name,
      kind: 'scout',
      status: 'completed',
      startedMinute: '01:00',
      completedMinute: '03:20',
    }),
    agentOf({
      id: C09_IMPLEMENTER_ID,
      runId: C09_RUN_ID,
      stepId: IMPLEMENT_STEP,
      ordinal: 1,
      name: IMPLEMENT.name,
      kind: 'implementer',
      status: 'completed',
      startedMinute: '03:40',
      completedMinute: '09:10',
    }),
  ];
  if (isReady) {
    return steps;
  }
  const isStepBlocked = state === 'step-blocked';
  const tester = agentOf({
    id: C09_TESTER_ID,
    runId: C09_RUN_ID,
    stepId: TEST_STEP,
    ordinal: 2,
    name: TEST.name,
    kind: 'tester',
    status: testerStatus,
    startedMinute: '09:30',
    ...(testerStatus === 'completed' ? { completedMinute: '10:50' } : {}),
  });
  const children: ReadonlyArray<Agent> = isStepBlocked
    ? []
    : [
        agentOf({
          id: FIXTURE_ID,
          runId: C09_RUN_ID,
          stepId: TEST_STEP,
          ordinal: 3,
          name: 'Build the 12k row fixture',
          kind: 'scout',
          status: 'completed',
          startedMinute: '09:35',
          completedMinute: '10:05',
          parentAgentId: C09_TESTER_ID,
        }),
        agentOf({
          id: BENCH_ID,
          runId: C09_RUN_ID,
          stepId: TEST_STEP,
          ordinal: 4,
          name: 'Time the export five times',
          kind: 'scout',
          status: testerStatus,
          startedMinute: '10:10',
          ...(testerStatus === 'completed' ? { completedMinute: '10:45' } : {}),
          parentAgentId: C09_TESTER_ID,
        }),
      ];
  const docs: ReadonlyArray<Agent> = isFinished({ state })
    ? [
        agentOf({
          id: DOCS_ID,
          runId: C09_RUN_ID,
          stepId: DOCS_STEP,
          ordinal: 5,
          name: DOCS.name,
          kind: 'docs',
          status: 'completed',
          startedMinute: '11:00',
          completedMinute: '11:20',
        }),
      ]
    : [];
  return [...steps, tester, ...children, ...docs];
};

const PRESET_AGENT: Agent = agentOf({
  id: PRESET_AGENT_ID,
  runId: PRESET_RUN_ID,
  stepId: PRESET_STEP,
  ordinal: 6,
  name: 'Find the flaky tests',
  kind: 'scout',
  status: 'completed',
  startedMinute: '00:10',
  completedMinute: '00:40',
});

type TurnParams = {
  readonly runId: ProviderRunId;
  readonly user: string;
  readonly answer: string;
  readonly startMinute: string;
  readonly endMinute: string;
};

const finishedTurn = ({
  runId,
  user,
  answer,
  startMinute,
  endMinute,
}: TurnParams): ReadonlyArray<TurnEvent> => [
  { kind: 'user_text', runId, text: user, at: at(startMinute) },
  { kind: 'assistant_text', runId, delta: answer, at: at(endMinute) },
  {
    kind: 'usage',
    runId,
    at: at(endMinute),
    usage: {
      inputTokens: 18400,
      outputTokens: 920,
      cachedInputTokens: 12000,
      estimatedCostUsd: 0.3,
    },
  },
  { kind: 'done', runId, at: at(endMinute) },
];

const TESTER_WORKING: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: TEST_RUN,
    text: 'Run the export on 12,000 rows five times and report the median.',
    at: at('09:30'),
  },
  {
    kind: 'assistant_text',
    runId: TEST_RUN,
    delta: 'The fixture is ready. Timing the export now.',
    at: at('10:10'),
  },
  {
    kind: 'tool_call_start',
    runId: TEST_RUN,
    toolUseId: 'c09-bench',
    toolName: 'Bash',
    input: { command: 'pnpm --filter payments-api bench export --rows 12000 --runs 5' },
    at: at('10:12'),
  },
];

const TESTER_BLOCKED = finishedTurn({
  runId: TEST_RUN,
  user: 'Run the export on 12,000 rows five times and report the median.',
  answer:
    'The fixture is ready and the first run took 4.2s.\n\nThe benchmark script writes its report next to the CSV. Should I keep the report in the repo or only attach it to the notes?',
  startMinute: '09:30',
  endMinute: '10:50',
});

const TESTER_DONE = finishedTurn({
  runId: TEST_RUN,
  user: 'Run the export on 12,000 rows five times and report the median.',
  answer: 'Median 4.1s over five runs, down from 38s. The CSV is byte for byte the same.',
  startMinute: '09:30',
  endMinute: '10:50',
});

const testerTranscriptOf = ({ state }: StateParams): ReadonlyArray<TurnEvent> => {
  if (state === 'running') {
    return TESTER_WORKING;
  }
  return state === 'step-blocked' ? TESTER_BLOCKED : TESTER_DONE;
};

const transcriptsOf = ({
  state,
}: StateParams): Readonly<Record<string, ReadonlyArray<TurnEvent>>> => ({
  [C09_SCOUT_ID]: finishedTurn({
    runId: SCOUT_RUN,
    user: 'Find where the export spends its time.',
    answer: 'The export runs one query per row. 10,000 rows means 10,000 round trips.',
    startMinute: '01:00',
    endMinute: '03:20',
  }),
  [C09_IMPLEMENTER_ID]: finishedTurn({
    runId: IMPLEMENT_RUN,
    user: 'Batch the row reads.',
    answer: 'Rows are read 500 at a time now. The CSV writer is unchanged.',
    startMinute: '03:40',
    endMinute: '09:10',
  }),
  [C09_TESTER_ID]: testerTranscriptOf({ state }),
  [DOCS_ID]: finishedTurn({
    runId: DOCS_RUN,
    user: 'Write the export notes.',
    answer: 'The notes hold the before and after numbers.',
    startMinute: '11:00',
    endMinute: '11:20',
  }),
});

type TelemetryParams = {
  readonly runId: ProviderRunId;
  readonly costUsd: number;
};

const telemetryOf = ({ runId, costUsd }: TelemetryParams): TelemetryRecord => ({
  id: idOf<TelemetryRecordId>(`mock-c09-telemetry-${runId}`),
  runId,
  sessionId: C09_SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  inputTokens: 18400,
  outputTokens: 920,
  contextTokens: 52000,
  estimatedCostUsd: costUsd,
  recordedAt: C09_NOW,
});

const turnStateOf = ({ state }: StateParams): TurnState =>
  state === 'running'
    ? { kind: 'running', runId: TEST_RUN, startedAt: at('09:30') }
    : { kind: 'idle', lastActivityAt: C09_NOW };

type SessionParams = RunParams & {
  readonly page: C09Page;
};

const sessionOf = ({ state, page, isRouted }: SessionParams): Session => ({
  id: C09_SESSION_ID,
  workspaceId: C09_WORKSPACE_ID,
  goal: 'Ledger export speed up',
  state: { kind: 'idle', lastActivityAt: C09_NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: page === 'empty' ? [PRESET_RUN] : [runOf({ state, isRouted }), PRESET_RUN],
  autoRun: false,
  titleUserEdited: true,
  createdAt: at('00:00'),
  updatedAt: C09_NOW,
});

export const seedC09 = ({
  state,
  page,
  isGuidanceRepeated = false,
  isRouted = false,
}: SeedParams): Session => {
  const session = sessionOf({ state, page, isRouted });
  const isDocument = page === 'document' || page === 'step';
  useAppStore.setState({
    currentWorkspaceId: C09_WORKSPACE_ID,
    sessions: [session],
    currentSessionId: C09_SESSION_ID,
    activeLens: { [C09_SESSION_ID]: isDocument ? 'workflows' : 'orchestrated' },
    focusedWorkflowRunId: { [C09_SESSION_ID]: isDocument ? C09_RUN_ID : null },
    selectedAgentId: { [C09_SESSION_ID]: null },
    sessionWorkflows: {
      [C09_SESSION_ID]: [workflowOf({ state, isGuidanceRepeated }), PRESET_WORKFLOW],
    },
    phaseTemplates: { [C09_WORKSPACE_ID]: [PRESET_WORKFLOW] },
    sessionPhaseRuns: {
      [C09_SESSION_ID]: page === 'empty' ? [PRESET_AGENT] : [...agentsOf({ state }), PRESET_AGENT],
    },
    sessionTelemetry: {
      [C09_SESSION_ID]: [
        telemetryOf({ runId: SCOUT_RUN, costUsd: 0.28 }),
        telemetryOf({ runId: IMPLEMENT_RUN, costUsd: 0.52 }),
        telemetryOf({ runId: TEST_RUN, costUsd: 0.32 }),
        ...(isFinished({ state }) ? [telemetryOf({ runId: DOCS_RUN, costUsd: 0.09 })] : []),
      ],
    },
    agentRunHistory: {
      [C09_SCOUT_ID]: [SCOUT_RUN],
      [C09_IMPLEMENTER_ID]: [IMPLEMENT_RUN],
      [C09_TESTER_ID]: [TEST_RUN],
      [DOCS_ID]: [DOCS_RUN],
    },
    agentTurnState: { [C09_TESTER_ID]: turnStateOf({ state }) },
    transcripts: transcriptsOf({ state }),
    orchestratingWorkflowRuns: { [C09_RUN_ID]: state === 'reading' },
    orchestratorReadingHints: { [C09_RUN_ID]: state === 'reading' ? [QUEUED_HINT.id] : [] },
    messages: { [C09_SESSION_ID]: [] },
    loadAgentTranscript: async () => undefined,
    loadSessionTelemetry: async () => undefined,
    sessionPlans: { [C09_SESSION_ID]: [] },
    sessionOpenQuestions: { [C09_SESSION_ID]: [] },
    sessionAnsweredQuestions: { [C09_SESSION_ID]: [] },
    drawer:
      page === 'step'
        ? {
            kind: 'run-step',
            sessionId: C09_SESSION_ID,
            payload: { runId: C09_RUN_ID, agentId: C09_TESTER_ID },
          }
        : null,
  });
  return session;
};
