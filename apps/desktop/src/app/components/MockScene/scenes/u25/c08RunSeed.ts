import {
  DEFAULT_WORKFLOW_RULES,
  type Agent,
  type AgentId,
  type ProviderRunId,
  type Session,
  type SessionId,
  type Step,
  type StepId,
  type TelemetryRecord,
  type TelemetryRecordId,
  type TurnEvent,
  type TurnState,
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

const C08_NOW = at('12:00');

const idOf = <T>(value: string): T => JSON.parse(JSON.stringify(value));

export const C08_WORKSPACE_ID = idOf<WorkspaceId>('mock-c08-workspace');

const WORKSPACE_ID = C08_WORKSPACE_ID;
export const C08_SESSION_ID = idOf<SessionId>('mock-c08-session');
const WORKFLOW_ID = idOf<WorkflowId>('mock-c08-workflow');
const DOCS_WORKFLOW_ID = idOf<WorkflowId>('mock-c08-workflow-docs');
export const C08_RUN_ID = idOf<WorkflowRunId>('mock-c08-run');
const DOCS_RUN_ID = idOf<WorkflowRunId>('mock-c08-run-docs');
const OLD_RUN_ID = idOf<WorkflowRunId>('mock-c08-run-old');
const NEXT_RUN_ID = idOf<WorkflowRunId>('mock-c08-run-next');
const SCOUT_STEP = idOf<StepId>('mock-c08-step-scout');
const IMPLEMENT_STEP = idOf<StepId>('mock-c08-step-implement');
const REVIEW_STEP = idOf<StepId>('mock-c08-step-review');
const DOCS_STEP = idOf<StepId>('mock-c08-step-docs');
export const C08_SCOUT_ID = idOf<AgentId>('mock-c08-scout');
export const C08_IMPLEMENTER_ID = idOf<AgentId>('mock-c08-implementer');
export const C08_REVIEWER_ID = idOf<AgentId>('mock-c08-reviewer');
const DOCS_AGENT_ID = idOf<AgentId>('mock-c08-docs');
const OLD_AGENT_ID = idOf<AgentId>('mock-c08-old');
const SCOUT_RUN = idOf<ProviderRunId>('mock-c08-provider-scout');
const IMPLEMENT_RUN = idOf<ProviderRunId>('mock-c08-provider-implement');
const REVIEW_RUN = idOf<ProviderRunId>('mock-c08-provider-review');
const DOCS_RUN = idOf<ProviderRunId>('mock-c08-provider-docs');

export type C08State = 'working' | 'ready' | 'approval' | 'capped' | 'done' | 'archived';

export type C08Selection = 'overview' | 'scout' | 'implementer' | 'reviewer';

type SeedParams = {
  readonly state: C08State;
  readonly selection: C08Selection | 'list';
};

type StepParams = {
  readonly id: StepId;
  readonly workflowId: WorkflowId;
  readonly ordinal: number;
  readonly name: string;
  readonly role: Step['role'];
};

const stepOf = ({ id, workflowId, ordinal, name, role }: StepParams): Step => ({
  id,
  workflowId,
  ordinal,
  name,
  role,
  promptPrefix: '',
});

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Fix flaky tests',
  description: 'Find the flaky tests, fix them, then check the fix.',
  isPreset: true,
  origin: 'library',
  steps: [
    stepOf({
      id: SCOUT_STEP,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Find the flaky tests',
      role: 'scout',
    }),
    stepOf({
      id: IMPLEMENT_STEP,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Fix the batching',
      role: 'implementer',
    }),
    stepOf({
      id: REVIEW_STEP,
      workflowId: WORKFLOW_ID,
      ordinal: 2,
      name: 'Check the fix',
      role: 'reviewer',
    }),
  ],
  createdAt: at('00:00'),
  updatedAt: at('00:00'),
};

const DOCS_WORKFLOW: Workflow = {
  id: DOCS_WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Write the docs',
  description: '',
  isPreset: true,
  origin: 'library',
  steps: [
    stepOf({
      id: DOCS_STEP,
      workflowId: DOCS_WORKFLOW_ID,
      ordinal: 0,
      name: 'Document the retry cap',
      role: 'docs',
    }),
  ],
  createdAt: at('00:00'),
  updatedAt: at('00:00'),
};

const HOLD_MESSAGE = 'The plan is ready. Approve it to start the rest of the run.';

type RunParams = {
  readonly state: C08State;
};

const runStopOf = ({ state }: RunParams): Pick<WorkflowRun, 'orchestrationStop'> => {
  if (state === 'approval') {
    return { orchestrationStop: { kind: 'plan-approval', message: HOLD_MESSAGE } };
  }
  if (state === 'capped') {
    return {
      orchestrationStop: { kind: 'budget', message: 'Paused at the $3.00 limit for this run.' },
    };
  }
  return {};
};

const mainRunOf = ({ state }: RunParams): WorkflowRun => ({
  id: C08_RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 3,
  currentStep: 1,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  title: 'Fix flaky tests in the ledger export',
  goal: 'The ledger export tests fail one run in five on CI. Find why and make them pass every time.',
  createdAt: at('01:00'),
  spendLimitUsd: 3,
  spendLimitMode: 'pause',
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: state === 'approval' ? 'plan' : 'step' },
  ...runStopOf({ state }),
  ...(state === 'archived' ? { discardedAt: at('11:00') } : {}),
});

const OTHER_RUNS: ReadonlyArray<WorkflowRun> = [
  {
    id: DOCS_RUN_ID,
    workflowId: DOCS_WORKFLOW_ID,
    ordinal: 2,
    currentStep: 0,
    autoRun: true,
    triggerMode: 'immediate',
    executionMode: 'static',
    title: 'Document the payments-api retry cap',
    createdAt: at('00:10'),
  },
  {
    id: OLD_RUN_ID,
    workflowId: WORKFLOW_ID,
    ordinal: 1,
    currentStep: 0,
    autoRun: false,
    triggerMode: 'immediate',
    executionMode: 'static',
    title: 'First try at the flaky export tests',
    createdAt: at('00:05'),
    discardedAt: at('00:40'),
  },
  {
    id: NEXT_RUN_ID,
    workflowId: DOCS_WORKFLOW_ID,
    ordinal: 4,
    currentStep: 0,
    autoRun: false,
    triggerMode: 'manual',
    executionMode: 'static',
    title: 'Document the export batching',
    createdAt: at('11:30'),
  },
];

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
  readonly model: string;
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
  model,
}: AgentParams): Agent => ({
  id,
  sessionId: C08_SESSION_ID,
  workflowRunId: runId,
  stepId,
  ordinal,
  name,
  kind,
  status,
  providerOverride: 'anthropic',
  modelOverride: model,
  effort: 'high',
  ...(startedMinute === undefined ? {} : { startedAt: at(startedMinute) }),
  ...(completedMinute === undefined ? {} : { completedAt: at(completedMinute) }),
});

type StatusTable = Readonly<Record<C08State, readonly [Agent['status'], Agent['status']]>>;

const LATER_STATUS: StatusTable = {
  working: ['running', 'pending'],
  ready: ['completed', 'pending'],
  approval: ['pending', 'pending'],
  capped: ['pending', 'pending'],
  done: ['completed', 'completed'],
  archived: ['completed', 'completed'],
};

const mainAgentsOf = ({ state }: RunParams): ReadonlyArray<Agent> => {
  const [implementStatus, reviewStatus] = LATER_STATUS[state];
  return [
    agentOf({
      id: C08_SCOUT_ID,
      runId: C08_RUN_ID,
      stepId: SCOUT_STEP,
      ordinal: 0,
      name: 'Find the flaky tests',
      kind: 'scout',
      status: 'completed',
      startedMinute: '01:00',
      completedMinute: '03:10',
      model: 'claude-sonnet-5-5',
    }),
    agentOf({
      id: C08_IMPLEMENTER_ID,
      runId: C08_RUN_ID,
      stepId: IMPLEMENT_STEP,
      ordinal: 1,
      name: 'Fix the batching',
      kind: 'implementer',
      status: implementStatus,
      ...(implementStatus === 'pending' ? {} : { startedMinute: '04:00' }),
      ...(implementStatus === 'completed' ? { completedMinute: '08:20' } : {}),
      model: 'claude-sonnet-5-5',
    }),
    agentOf({
      id: C08_REVIEWER_ID,
      runId: C08_RUN_ID,
      stepId: REVIEW_STEP,
      ordinal: 2,
      name: 'Check the fix',
      kind: 'reviewer',
      status: reviewStatus,
      ...(reviewStatus === 'pending' ? {} : { startedMinute: '08:30', completedMinute: '10:40' }),
      model: 'claude-opus-5',
    }),
  ];
};

const OTHER_AGENTS: ReadonlyArray<Agent> = [
  agentOf({
    id: DOCS_AGENT_ID,
    runId: DOCS_RUN_ID,
    stepId: DOCS_STEP,
    ordinal: 3,
    name: 'Document the retry cap',
    kind: 'docs',
    status: 'completed',
    startedMinute: '00:10',
    completedMinute: '00:30',
    model: 'claude-sonnet-5-5',
  }),
  agentOf({
    id: OLD_AGENT_ID,
    runId: OLD_RUN_ID,
    stepId: SCOUT_STEP,
    ordinal: 4,
    name: 'Find the flaky tests',
    kind: 'scout',
    status: 'stopped',
    startedMinute: '00:05',
    model: 'claude-sonnet-5-5',
  }),
];

type TextParams = {
  readonly runId: ProviderRunId;
  readonly user: string;
  readonly answer: string;
  readonly startMinute: string;
  readonly endMinute: string;
  readonly command: string;
};

const finishedTurn = ({
  runId,
  user,
  answer,
  startMinute,
  endMinute,
  command,
}: TextParams): ReadonlyArray<TurnEvent> => [
  { kind: 'user_text', runId, text: user, at: at(startMinute) },
  {
    kind: 'tool_call_start',
    runId,
    toolUseId: `${runId}-cmd`,
    toolName: 'Bash',
    input: { command },
    at: at(startMinute),
  },
  {
    kind: 'tool_call_end',
    runId,
    toolUseId: `${runId}-cmd`,
    output: 'ok',
    isError: false,
    at: at(endMinute),
  },
  { kind: 'assistant_text', runId, delta: answer, at: at(endMinute) },
  {
    kind: 'usage',
    runId,
    at: at(endMinute),
    usage: {
      inputTokens: 18400,
      outputTokens: 920,
      cachedInputTokens: 12000,
      estimatedCostUsd: 0.42,
    },
  },
  { kind: 'done', runId, at: at(endMinute) },
];

const SCOUT_TURN = finishedTurn({
  runId: SCOUT_RUN,
  user: 'Find why the ledger export tests fail one run in five.',
  answer:
    'The export batches rows by 500 and the last batch is dropped when the row count is a multiple of 500. Two tests hit it at random because the fixture size is random.',
  startMinute: '01:00',
  endMinute: '03:10',
  command: 'pnpm test --filter payments-api export --repeat 20',
});

const IMPLEMENT_DONE = finishedTurn({
  runId: IMPLEMENT_RUN,
  user: 'Fix the batching so the last batch is always written.',
  answer: 'The last batch is now flushed after the loop. 20 of 20 runs pass on 12,000 rows.',
  startMinute: '04:00',
  endMinute: '08:20',
  command: 'pnpm test --filter payments-api export --repeat 20',
});

const IMPLEMENT_WORKING: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: IMPLEMENT_RUN,
    text: 'Fix the batching so the last batch is always written.',
    at: at('04:00'),
  },
  {
    kind: 'assistant_text',
    runId: IMPLEMENT_RUN,
    delta: 'Reading the batch writer.',
    at: at('04:10'),
  },
  {
    kind: 'tool_call_start',
    runId: IMPLEMENT_RUN,
    toolUseId: 'c08-implement-read',
    toolName: 'Read',
    input: { file_path: '/mock/payments-api/src/export/batchWriter.ts' },
    at: at('04:20'),
  },
];

const REVIEW_DONE = finishedTurn({
  runId: REVIEW_RUN,
  user: 'Check the fix.',
  answer: '20 of 20 runs pass. The fix is correct and the new test covers a multiple of 500.',
  startMinute: '08:30',
  endMinute: '10:40',
  command: 'pnpm test --filter payments-api export --repeat 20',
});

const DOCS_DONE = finishedTurn({
  runId: DOCS_RUN,
  user: 'Document the retry cap.',
  answer: 'The retry cap is documented in docs/retries.md.',
  startMinute: '00:10',
  endMinute: '00:30',
  command: 'pnpm lint docs',
});

const isLaterDone = ({ state }: RunParams): boolean => state === 'done' || state === 'archived';

const transcriptsOf = ({
  state,
}: RunParams): Readonly<Record<string, ReadonlyArray<TurnEvent>>> => {
  const [implementStatus] = LATER_STATUS[state];
  const implement =
    implementStatus === 'running'
      ? IMPLEMENT_WORKING
      : implementStatus === 'completed'
        ? IMPLEMENT_DONE
        : [];
  return {
    [C08_SCOUT_ID]: SCOUT_TURN,
    [C08_IMPLEMENTER_ID]: implement,
    [C08_REVIEWER_ID]: isLaterDone({ state }) ? REVIEW_DONE : [],
    [DOCS_AGENT_ID]: DOCS_DONE,
  };
};

type TelemetryParams = {
  readonly runId: ProviderRunId;
  readonly costUsd: number;
};

const telemetryOf = ({ runId, costUsd }: TelemetryParams): TelemetryRecord => ({
  id: idOf<TelemetryRecordId>(`mock-c08-telemetry-${runId}`),
  runId,
  sessionId: C08_SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  inputTokens: 18400,
  outputTokens: 920,
  contextTokens: 52000,
  estimatedCostUsd: costUsd,
  recordedAt: C08_NOW,
});

const turnStateOf = ({ state }: RunParams): TurnState =>
  state === 'working'
    ? { kind: 'running', runId: IMPLEMENT_RUN, startedAt: at('04:00') }
    : { kind: 'idle', lastActivityAt: C08_NOW };

const sessionOf = ({ state }: RunParams): Session => ({
  id: C08_SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Make the Harborline ledger export reliable',
  state: { kind: 'idle', lastActivityAt: C08_NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [mainRunOf({ state }), ...OTHER_RUNS],
  autoRun: false,
  titleUserEdited: true,
  createdAt: at('00:00'),
  updatedAt: C08_NOW,
});

const SELECTED: Readonly<Record<C08Selection, AgentId | null>> = {
  overview: null,
  scout: C08_SCOUT_ID,
  implementer: C08_IMPLEMENTER_ID,
  reviewer: C08_REVIEWER_ID,
};

export const seedC08 = ({ state, selection }: SeedParams): Session => {
  const session = sessionOf({ state });
  const isList = selection === 'list';
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [session],
    currentSessionId: C08_SESSION_ID,
    activeLens: { [C08_SESSION_ID]: 'workflows' },
    focusedWorkflowRunId: { [C08_SESSION_ID]: isList ? null : C08_RUN_ID },
    selectedAgentId: { [C08_SESSION_ID]: isList ? null : SELECTED[selection] },
    sessionWorkflows: { [C08_SESSION_ID]: [WORKFLOW, DOCS_WORKFLOW] },
    phaseTemplates: { [WORKSPACE_ID]: [WORKFLOW, DOCS_WORKFLOW] },
    sessionPhaseRuns: { [C08_SESSION_ID]: [...mainAgentsOf({ state }), ...OTHER_AGENTS] },
    sessionTelemetry: {
      [C08_SESSION_ID]: [
        telemetryOf({ runId: SCOUT_RUN, costUsd: 0.42 }),
        telemetryOf({ runId: IMPLEMENT_RUN, costUsd: state === 'capped' ? 2.58 : 0.7 }),
        telemetryOf({ runId: REVIEW_RUN, costUsd: 0.31 }),
        telemetryOf({ runId: DOCS_RUN, costUsd: 0.12 }),
      ],
    },
    agentRunHistory: {
      [C08_SCOUT_ID]: [SCOUT_RUN],
      [C08_IMPLEMENTER_ID]: [IMPLEMENT_RUN],
      [C08_REVIEWER_ID]: isLaterDone({ state }) ? [REVIEW_RUN] : [],
      [DOCS_AGENT_ID]: [DOCS_RUN],
    },
    agentTurnState: { [C08_IMPLEMENTER_ID]: turnStateOf({ state }) },
    transcripts: transcriptsOf({ state }),
    messages: { [C08_SESSION_ID]: [] },
    loadAgentTranscript: async () => undefined,
    loadSessionTelemetry: async () => undefined,
    sessionPlans: { [C08_SESSION_ID]: [] },
    sessionOpenQuestions: { [C08_SESSION_ID]: [] },
    sessionAnsweredQuestions: { [C08_SESSION_ID]: [] },
  });
  return session;
};
