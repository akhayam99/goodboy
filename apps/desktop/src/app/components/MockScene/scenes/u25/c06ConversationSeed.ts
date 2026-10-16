import type {
  Agent,
  AgentId,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecord,
  TelemetryRecordId,
  TurnEvent,
  TurnState,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-09-14T15:12:00.000Z' });

const C06_NOW = clock.iso({ at: '2026-09-14T15:12:00.000Z' });

const at = (minute: string) => clock.iso({ at: `2026-09-14T15:${minute}.000Z` });

const WORKSPACE_ID: WorkspaceId = JSON.parse('"mock-c06-workspace"');
export const C06_SESSION_ID: SessionId = JSON.parse('"mock-c06-session"');
export const C06_AGENT_ID: AgentId = JSON.parse('"mock-c06-implementer"');
const TESTER_ID: AgentId = JSON.parse('"mock-c06-tester"');
const SCOUT_ID: AgentId = JSON.parse('"mock-c06-scout"');
const REVIEWER_ID: AgentId = JSON.parse('"mock-c06-reviewer"');
const RUN_ONE: ProviderRunId = JSON.parse('"mock-c06-run-1"');
const RUN_TWO: ProviderRunId = JSON.parse('"mock-c06-run-2"');

export const C06_SESSION: Session = {
  id: C06_SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Speed up the Harborline ledger export',
  state: { kind: 'idle', lastActivityAt: C06_NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: at('00:00'),
  updatedAt: C06_NOW,
};

export type C06State = 'working' | 'finished' | 'failed' | 'permission' | 'delegating';

type StateParams = {
  readonly state: C06State;
};

type PlanParams = {
  readonly runId: ProviderRunId;
  readonly id: string;
  readonly minute: string;
  readonly statuses: readonly [string, string, string];
};

type UsageParams = {
  readonly runId: ProviderRunId;
  readonly minute: string;
};

type TelemetryParams = {
  readonly runId: ProviderRunId;
  readonly model: string;
};

type AgentsSeedParams = {
  readonly isEmpty: boolean;
};

type AgentParams = {
  readonly id: AgentId;
  readonly name: string;
  readonly kind: Agent['kind'];
  readonly status: Agent['status'];
  readonly ordinal: number;
  readonly startedMinute: string;
  readonly completedMinute?: string;
  readonly parentAgentId?: AgentId;
  readonly model?: string;
};

const C06_MODEL = 'claude-sonnet-5-5';

const agentOf = ({
  id,
  name,
  kind,
  status,
  ordinal,
  startedMinute,
  completedMinute,
  parentAgentId,
  model = C06_MODEL,
}: AgentParams): Agent => ({
  id,
  sessionId: C06_SESSION_ID,
  ordinal,
  name,
  status,
  kind,
  providerOverride: 'anthropic',
  modelOverride: model,
  effort: 'high',
  startedAt: at(startedMinute),
  ...(completedMinute === undefined ? {} : { completedAt: at(completedMinute) }),
  ...(parentAgentId === undefined ? {} : { parentAgentId }),
});

const STATUS: Record<C06State, Agent['status']> = {
  working: 'running',
  finished: 'completed',
  failed: 'failed',
  permission: 'running',
  delegating: 'running',
};

const c06Agent = ({ state }: StateParams): Agent =>
  agentOf({
    id: C06_AGENT_ID,
    name: 'Reinstall dependencies in payments-api',
    kind: 'implementer',
    status: STATUS[state],
    ordinal: 0,
    startedMinute: '08:00',
    ...(state === 'finished' || state === 'failed' ? { completedMinute: '11:40' } : {}),
  });

const C06_OUTCOME = 'payments-api now installs with pnpm; the export tests pass on 12,000 rows.';

const withOutcome = ({ state }: StateParams): Agent =>
  state === 'finished'
    ? { ...c06Agent({ state }), outputSummary: C06_OUTCOME }
    : c06Agent({ state });

const CHILDREN: ReadonlyArray<Agent> = [
  agentOf({
    id: SCOUT_ID,
    name: 'Map the export batching',
    kind: 'scout',
    status: 'completed',
    ordinal: 1,
    startedMinute: '09:00',
    completedMinute: '09:50',
    parentAgentId: C06_AGENT_ID,
  }),
  agentOf({
    id: TESTER_ID,
    name: 'Run the export tests on 12,000 rows',
    kind: 'tester',
    status: 'running',
    ordinal: 2,
    startedMinute: '10:10',
    parentAgentId: C06_AGENT_ID,
  }),
];

const OTHERS: ReadonlyArray<Agent> = [
  agentOf({
    id: REVIEWER_ID,
    name: 'Review the ledger-core retry cap',
    kind: 'reviewer',
    status: 'completed',
    ordinal: 3,
    startedMinute: '01:00',
    completedMinute: '04:20',
    model: 'claude-opus-5',
  }),
];

type ToolParams = {
  readonly runId: ProviderRunId;
  readonly id: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly output: unknown;
  readonly isError?: boolean;
  readonly minute: string;
};

const tool = ({
  runId,
  id,
  toolName,
  input,
  output,
  isError = false,
  minute,
}: ToolParams): ReadonlyArray<TurnEvent> => [
  { kind: 'tool_call_start', runId, toolUseId: id, toolName, input, at: at(minute) },
  { kind: 'tool_call_end', runId, toolUseId: id, output, isError, at: at(minute) },
];

const plan = ({ runId, id, minute, statuses }: PlanParams): ReadonlyArray<TurnEvent> =>
  tool({
    runId,
    id,
    toolName: 'TodoWrite',
    minute,
    output: 'ok',
    input: {
      todos: [
        { content: 'Remove node_modules in payments-api', status: statuses[0] },
        { content: 'Install with pnpm', status: statuses[1] },
        { content: 'Run the export tests', status: statuses[2] },
      ],
    },
  });

const usage = ({ runId, minute }: UsageParams): ReadonlyArray<TurnEvent> => [
  {
    kind: 'usage',
    runId,
    at: at(minute),
    usage: {
      inputTokens: 18400,
      outputTokens: 920,
      cachedInputTokens: 12000,
      estimatedCostUsd: 0.12,
    },
  },
  { kind: 'done', runId, at: at(minute) },
];

const TURN_ONE: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: RUN_ONE,
    text: 'Reinstall dependencies in payments-api. The lockfile changed on main.',
    at: at('08:00'),
  },
  {
    kind: 'assistant_text',
    runId: RUN_ONE,
    delta: 'Checking the lockfiles first.',
    at: at('08:05'),
  },
  ...plan({
    runId: RUN_ONE,
    id: 'c06-plan-1',
    minute: '08:06',
    statuses: ['in_progress', 'pending', 'pending'],
  }),
  ...tool({
    runId: RUN_ONE,
    id: 'c06-read-1',
    toolName: 'Read',
    input: { file_path: '/mock/payments-api/package.json' },
    output: '{ "name": "payments-api" }',
    minute: '08:10',
  }),
  ...tool({
    runId: RUN_ONE,
    id: 'c06-bash-1',
    toolName: 'Bash',
    input: { command: 'rm -rf node_modules' },
    output: '',
    minute: '08:20',
  }),
  {
    kind: 'assistant_text',
    runId: RUN_ONE,
    delta:
      'The repo has both pnpm-lock.yaml and yarn.lock. I removed node_modules and will install with pnpm, since main moved to it last week.',
    at: at('08:40'),
  },
  ...usage({ runId: RUN_ONE, minute: '08:41' }),
];

const TURN_TWO_USER: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: RUN_TWO,
    text: 'Go ahead, then run the export tests.',
    at: at('10:00'),
  },
];

const TURN_TWO_WORKING: ReadonlyArray<TurnEvent> = [
  ...TURN_TWO_USER,
  ...plan({
    runId: RUN_TWO,
    id: 'c06-plan-2',
    minute: '10:02',
    statuses: ['completed', 'in_progress', 'pending'],
  }),
  { kind: 'assistant_text', runId: RUN_TWO, delta: 'Installing now.', at: at('10:03') },
  {
    kind: 'tool_call_start',
    runId: RUN_TWO,
    toolUseId: 'c06-bash-2',
    toolName: 'Bash',
    input: { command: 'pnpm install --frozen-lockfile' },
    at: at('10:04'),
  },
];

const TURN_TWO_FINISHED: ReadonlyArray<TurnEvent> = [
  ...TURN_TWO_USER,
  ...plan({
    runId: RUN_TWO,
    id: 'c06-plan-2',
    minute: '10:02',
    statuses: ['completed', 'completed', 'completed'],
  }),
  ...tool({
    runId: RUN_TWO,
    id: 'c06-bash-2',
    toolName: 'Bash',
    input: { command: 'pnpm install --frozen-lockfile' },
    output: 'Done in 41s',
    minute: '10:45',
  }),
  ...tool({
    runId: RUN_TWO,
    id: 'c06-bash-3',
    toolName: 'Bash',
    input: { command: 'pnpm test --filter payments-api export' },
    output: '24 passed',
    minute: '11:30',
  }),
  {
    kind: 'assistant_text',
    runId: RUN_TWO,
    delta: 'Dependencies are installed with pnpm and the 24 export tests pass.',
    at: at('11:39'),
  },
  ...usage({ runId: RUN_TWO, minute: '11:40' }),
];

const TURN_TWO_FAILED: ReadonlyArray<TurnEvent> = [
  ...TURN_TWO_USER,
  ...plan({
    runId: RUN_TWO,
    id: 'c06-plan-2',
    minute: '10:02',
    statuses: ['completed', 'in_progress', 'pending'],
  }),
  ...['a', 'b', 'c', 'd'].flatMap((suffix, index) =>
    tool({
      runId: RUN_TWO,
      id: `c06-read-${suffix}`,
      toolName: 'Read',
      input: { file_path: `/mock/payments-api/src/export/batch${index}.ts` },
      output: 'export const batch = 1;',
      minute: `10:0${index + 3}`,
    }),
  ),
  ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((index) =>
    tool({
      runId: RUN_TWO,
      id: `c06-cmd-${index}`,
      toolName: 'Bash',
      input: { command: index < 6 ? `pnpm why ledger-core ${index}` : 'pnpm install' },
      output: index < 6 ? 'ok' : 'ERR_PNPM_FETCH_404 registry.npmjs.org',
      isError: index >= 6,
      minute: `10:${20 + index}`,
    }),
  ),
  {
    kind: 'assistant_text',
    runId: RUN_TWO,
    delta: 'The install stopped: pnpm could not reach the registry.',
    at: at('11:39'),
  },
  {
    kind: 'error',
    runId: RUN_TWO,
    message: 'pnpm exited with code 1.',
    retryable: true,
    at: at('11:39'),
  },
  ...usage({ runId: RUN_TWO, minute: '11:40' }),
];

const TURN_TWO_PERMISSION: ReadonlyArray<TurnEvent> = [
  ...TURN_TWO_USER,
  {
    kind: 'tool_call_start',
    runId: RUN_TWO,
    toolUseId: 'c06-bash-perm',
    toolName: 'Bash',
    input: { command: 'rm -rf node_modules' },
    at: at('10:05'),
  },
  {
    kind: 'permission_request',
    runId: RUN_TWO,
    toolUseId: 'c06-bash-perm',
    toolName: 'Bash',
    input: { command: 'rm -rf node_modules' },
    at: at('10:05'),
  },
];

const TRANSCRIPT: Record<C06State, ReadonlyArray<TurnEvent>> = {
  working: [...TURN_ONE, ...TURN_TWO_WORKING],
  finished: [...TURN_ONE, ...TURN_TWO_FINISHED],
  failed: [...TURN_ONE, ...TURN_TWO_FAILED],
  permission: [...TURN_ONE, ...TURN_TWO_PERMISSION],
  delegating: [...TURN_ONE, ...TURN_TWO_WORKING],
};

const telemetryIdOf = ({ runId }: TelemetryParams): TelemetryRecordId =>
  JSON.parse(JSON.stringify(`mock-c06-telemetry-${runId}`));

const turnStateOf = ({ state }: StateParams): TurnState => {
  if (state === 'working' || state === 'delegating') {
    return { kind: 'running', runId: RUN_TWO, startedAt: at('10:00') };
  }
  if (state === 'permission') {
    return { kind: 'blocked', runId: RUN_TWO, blockedAt: at('10:05') };
  }
  return { kind: 'idle', lastActivityAt: C06_NOW };
};

const telemetryOf = ({ runId, model }: TelemetryParams): TelemetryRecord => ({
  id: telemetryIdOf({ runId, model }),
  runId,
  sessionId: C06_SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model,
  inputTokens: 18400,
  outputTokens: 920,
  contextTokens: 52000,
  estimatedCostUsd: 0.12,
  recordedAt: C06_NOW,
});

export const seedC06 = ({ state }: StateParams): Agent => {
  const agent = withOutcome({ state });
  const children = state === 'delegating' ? CHILDREN : [];
  useAppStore.setState({
    sessions: [C06_SESSION],
    currentSessionId: C06_SESSION_ID,
    selectedAgentId: { [C06_SESSION_ID]: C06_AGENT_ID },
    activeLens: { [C06_SESSION_ID]: 'agents' },
    sessionPhaseRuns: { [C06_SESSION_ID]: [agent, ...children, ...OTHERS] },
    sessionTelemetry: {
      [C06_SESSION_ID]: [
        telemetryOf({ runId: RUN_ONE, model: C06_MODEL }),
        telemetryOf({ runId: RUN_TWO, model: C06_MODEL }),
      ],
    },
    agentRunHistory: { [C06_AGENT_ID]: [RUN_ONE, RUN_TWO] },
    agentTurnState: { [C06_AGENT_ID]: turnStateOf({ state }) },
    transcripts: { [C06_AGENT_ID]: TRANSCRIPT[state] },
    messages: { [C06_SESSION_ID]: [] },
    loadAgentTranscript: async () => undefined,
    sessionPlans: { [C06_SESSION_ID]: [] },
    sessionOpenQuestions: { [C06_SESSION_ID]: [] },
    sessionAnsweredQuestions: { [C06_SESSION_ID]: [] },
  });
  return agent;
};

export const seedC06Agents = ({ isEmpty }: AgentsSeedParams): void => {
  seedC06({ state: 'delegating' });
  if (isEmpty) {
    useAppStore.setState({ sessionPhaseRuns: { [C06_SESSION_ID]: [] } });
  }
};
