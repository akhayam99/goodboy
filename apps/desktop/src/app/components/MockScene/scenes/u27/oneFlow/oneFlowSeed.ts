import { autoBudgetOf, autoTreeSpendOf } from '@goodboy/core';
import type { AutoDelegation, AutoPhase } from '@goodboy/db';
import {
  DEFAULT_WORKFLOW_RULES,
  brandId,
  type Agent,
  type AgentId,
  type AutoTreeId,
  type IsoDateTime,
  type ProviderRunId,
  type Session,
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
} from '@goodboy/types';
import { aDelegation, aTree } from '../../../../../../features/auto/testing/autoViewFixtures';
import type { AutoTreeView } from '../../../../../../store/slices/auto-view/state';
import type { OpenDrawer } from '../../../../../../store/slices/drawer/state';
import { useAppStore, type LensKind } from '../../../../../../store';
import { sceneClock } from '../../../sceneClock';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../../activityRunSeed';

const clock = sceneClock({ anchor: '2026-10-21T10:40:00.000Z' });

type MinuteParams = {
  readonly minute: number;
};

const START_MS = Date.UTC(2026, 9, 21, 10, 0);

const iso = ({ minute }: MinuteParams): IsoDateTime =>
  clock.iso({ at: new Date(START_MS + minute * 60_000).toISOString() });

const ms = ({ minute }: MinuteParams): number =>
  clock.ms({ at: new Date(START_MS + minute * 60_000).toISOString() });

const NOW = iso({ minute: 40 });

type OneFlowEra = 'before' | 'after';

type OneFlowPlace = 'overview' | 'preset' | 'orchestrated' | 'agent' | 'auto' | 'runs';

export const ONE_FLOW_GOAL = 'Center the member pages';

const ONE_FLOW_REPO = 'harbor-portal';

const BRANCH = 'hl/center-member-pages';

export const PRESET_NAME = 'Fix a layout';

const PRESET_ID = brandId<WorkflowId>({ value: 'mock-one-flow-preset' });
const PRESET_RUN_ID = brandId<WorkflowRunId>({ value: 'mock-one-flow-run-preset' });
const PLAN_WORKFLOW_ID = brandId<WorkflowId>({ value: 'mock-one-flow-plan' });
export const PLAN_RUN_ID = brandId<WorkflowRunId>({ value: 'mock-one-flow-run-plan' });

type StepSpec = Readonly<{
  key: string;
  role: NonNullable<Step['role']>;
  name: string;
  reason?: string;
}>;

const PRESET_STEPS: ReadonlyArray<StepSpec> = [
  { key: 'find', role: 'scout', name: 'Find every member page layout' },
  { key: 'center', role: 'implementer', name: 'Center the page wrapper' },
  { key: 'check', role: 'tester', name: 'Check each page at 390, 768 and 1440' },
];

const PLAN_STEPS_BEFORE: ReadonlyArray<StepSpec> = [
  {
    key: 'plan-find',
    role: 'scout',
    name: 'Find every member page layout',
    reason: 'Nobody knows yet which member pages use the old wrapper, so look first.',
  },
  {
    key: 'plan-center',
    role: 'implementer',
    name: 'Center the page wrapper',
    reason: 'The scout found one shared wrapper behind all six pages. Changing it once is enough.',
  },
  {
    key: 'plan-check',
    role: 'tester',
    name: 'Check each page at 390, 768 and 1440',
    reason: 'The wrapper changed for every page, so every page needs a look at three widths.',
  },
];

const ADDED_STEP_REASON =
  'Added to the preset: the scout found the billing table scrolls sideways at 390px, and the preset has no step for it.';

const PLAN_STEPS_AFTER: ReadonlyArray<StepSpec> = [
  {
    key: 'plan-find',
    role: 'scout',
    name: 'Find every member page layout',
    reason: 'Step 1 of the preset.',
  },
  {
    key: 'plan-center',
    role: 'implementer',
    name: 'Center the page wrapper',
    reason: 'Step 2 of the preset.',
  },
  {
    key: 'plan-billing',
    role: 'implementer',
    name: 'Stop the billing table scrolling sideways',
    reason: ADDED_STEP_REASON,
  },
  {
    key: 'plan-check',
    role: 'tester',
    name: 'Check each page at 390, 768 and 1440',
    reason: 'Step 3 of the preset, now that the billing table fits.',
  },
];

const PLAN_STEPS_STARTED: ReadonlyArray<StepSpec> = PRESET_STEPS.slice(0, 1).map((step) => ({
  ...step,
  key: `plan-${step.key}`,
  reason: 'Step 1 of the preset: nobody knows yet which member pages use the old wrapper.',
}));

type WorkflowStepParams = {
  readonly workflowId: WorkflowId;
  readonly steps: ReadonlyArray<StepSpec>;
};

const stepIdOf = ({ key }: Pick<StepSpec, 'key'>): StepId =>
  brandId<StepId>({ value: `mock-one-flow-step-${key}` });

const stepsOf = ({ workflowId, steps }: WorkflowStepParams): ReadonlyArray<Step> =>
  steps.map((step, ordinal) => ({
    id: stepIdOf({ key: step.key }),
    workflowId,
    ordinal,
    name: step.name,
    role: step.role,
    promptPrefix: '',
    ...(step.reason === undefined ? {} : { orchestratorReason: step.reason }),
  }));

const PRESET: Workflow = {
  id: PRESET_ID,
  workspaceId: SESSION.workspaceId,
  name: PRESET_NAME,
  description: 'Find the layouts, fix the shared wrapper, check every width.',
  steps: stepsOf({ workflowId: PRESET_ID, steps: PRESET_STEPS }),
  isPreset: true,
  origin: 'custom',
  createdAt: iso({ minute: -600 }),
  updatedAt: iso({ minute: -600 }),
};

type EraParams = {
  readonly era: OneFlowEra;
};

const planWorkflowOf = ({ era }: EraParams): Workflow => ({
  id: PLAN_WORKFLOW_ID,
  workspaceId: SESSION.workspaceId,
  name: era === 'after' ? ONE_FLOW_GOAL : 'Center every member page',
  description: '',
  origin: 'orchestrated',
  processText:
    era === 'after'
      ? `Start from the preset ${PRESET_NAME}. Adapt as it goes: add, skip or move a step when a finding asks for it, and say why.`
      : 'Keep the 390px layout working on every page.',
  steps: stepsOf({
    workflowId: PLAN_WORKFLOW_ID,
    steps: era === 'after' ? PLAN_STEPS_AFTER : PLAN_STEPS_BEFORE,
  }),
  createdAt: iso({ minute: 2 }),
  updatedAt: iso({ minute: 2 }),
});

const PRESET_RUN: WorkflowRun = {
  id: PRESET_RUN_ID,
  workflowId: PRESET_ID,
  ordinal: 0,
  currentStep: 1,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  title: 'Center the profile page',
  goal: 'Center the profile page of harbor-portal on every width.',
  createdAt: iso({ minute: 1 }),
};

const planRunOf = ({ era }: EraParams): WorkflowRun => ({
  id: PLAN_RUN_ID,
  workflowId: PLAN_WORKFLOW_ID,
  ordinal: 1,
  currentStep: era === 'after' ? 3 : 2,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  title: era === 'after' ? ONE_FLOW_GOAL : 'Center every member page',
  goal: 'Center the six member pages of harbor-portal (profile, billing, plans, team, security, notifications) on every width, and keep the 390px layout working.',
  createdAt: iso({ minute: 2 }),
  spendLimitUsd: 5,
  spendLimitMode: 'pause',
  providerPool: ['anthropic', 'codex'],
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' },
  orchestratorHints: [],
  orchestratorSummary: JSON.stringify({
    done:
      era === 'after'
        ? [
            'Found one shared wrapper behind the six member pages',
            'Centered the wrapper at a 960px measure',
            'Made the billing table scroll inside its card at 390px',
          ]
        : ['Found one shared wrapper behind the six member pages', 'Centered the wrapper'],
    left: [],
  }),
});

type AgentSpec = Readonly<{
  key: string;
  role: string;
  name: string;
  status: Agent['status'];
  minute: number;
  doneMinute?: number;
  runId?: WorkflowRunId;
  stepKey?: string;
  ordinal: number;
}>;

const agentIdOf = ({ key }: Pick<AgentSpec, 'key'>): AgentId =>
  brandId<AgentId>({ value: `mock-one-flow-agent-${key}` });

const providerRunOf = ({ key }: Pick<AgentSpec, 'key'>): ProviderRunId =>
  brandId<ProviderRunId>({ value: `mock-one-flow-provider-${key}` });

type AgentParams = {
  readonly spec: AgentSpec;
};

const agentOf = ({ spec }: AgentParams): Agent => ({
  id: agentIdOf({ key: spec.key }),
  sessionId: SESSION_ID,
  ordinal: spec.ordinal,
  name: spec.name,
  kind: spec.role,
  status: spec.status,
  providerOverride: 'anthropic',
  modelOverride: 'claude-sonnet-5-5',
  effort: 'medium',
  startedAt: iso({ minute: spec.minute }),
  lastViewedAt: NOW,
  ...(spec.runId === undefined ? {} : { workflowRunId: spec.runId }),
  ...(spec.stepKey === undefined ? {} : { stepId: stepIdOf({ key: spec.stepKey }) }),
  ...(spec.doneMinute === undefined
    ? {}
    : {
        completedAt: iso({ minute: spec.doneMinute }),
        lastFinishedAt: iso({ minute: spec.doneMinute }),
      }),
});

const PRESET_AGENTS: ReadonlyArray<AgentSpec> = [
  {
    key: 'preset-find',
    role: 'scout',
    name: 'Find every member page layout',
    status: 'completed',
    minute: 1,
    doneMinute: 4,
    runId: PRESET_RUN_ID,
    stepKey: 'find',
    ordinal: 0,
  },
  {
    key: 'preset-center',
    role: 'implementer',
    name: 'Center the page wrapper',
    status: 'running',
    minute: 30,
    runId: PRESET_RUN_ID,
    stepKey: 'center',
    ordinal: 1,
  },
  {
    key: 'preset-check',
    role: 'tester',
    name: 'Check each page at 390, 768 and 1440',
    status: 'pending',
    minute: 30,
    runId: PRESET_RUN_ID,
    stepKey: 'check',
    ordinal: 2,
  },
];

const planAgentsOf = ({ era }: EraParams): ReadonlyArray<AgentSpec> => [
  {
    key: 'plan-find',
    role: 'scout',
    name: 'Find every member page layout',
    status: 'completed',
    minute: 2,
    doneMinute: 6,
    runId: PLAN_RUN_ID,
    stepKey: 'plan-find',
    ordinal: 3,
  },
  {
    key: 'plan-center',
    role: 'implementer',
    name: 'Center the page wrapper',
    status: 'completed',
    minute: 7,
    doneMinute: 19,
    runId: PLAN_RUN_ID,
    stepKey: 'plan-center',
    ordinal: 4,
  },
  ...(era === 'after'
    ? [
        {
          key: 'plan-billing',
          role: 'implementer',
          name: 'Stop the billing table scrolling sideways',
          status: 'completed' as const,
          minute: 20,
          doneMinute: 29,
          runId: PLAN_RUN_ID,
          stepKey: 'plan-billing',
          ordinal: 5,
        },
      ]
    : []),
  {
    key: 'plan-check',
    role: 'tester',
    name: 'Check each page at 390, 768 and 1440',
    status: 'running',
    minute: 31,
    runId: PLAN_RUN_ID,
    stepKey: 'plan-check',
    ordinal: 6,
  },
];

const HAND_AGENT: AgentSpec = {
  key: 'hand-scout',
  role: 'scout',
  name: 'Which member pages still use the old wrapper?',
  status: 'completed',
  minute: 0,
  doneMinute: 3,
  ordinal: 7,
};

const HAND_AGENT_ID = agentIdOf({ key: HAND_AGENT.key });

type ChildSpec = Readonly<{
  key: string;
  role: string;
  title: string;
  state: AutoDelegation['state'];
  outcome: AutoDelegation['outcome'];
  minute: number;
}>;

const AUTO_KEY = 'auto-dark';

const AUTO_ASK = 'Check the member pages in dark mode and fix what looks wrong.';

const AUTO_CHILDREN: ReadonlyArray<ChildSpec> = [
  {
    key: 'auto-scout',
    role: 'scout',
    title: 'Find hard coded colors',
    state: 'settled',
    outcome: 'completed',
    minute: 33,
  },
  {
    key: 'auto-fix',
    role: 'implementer',
    title: 'Move billing and team to tokens',
    state: 'running',
    outcome: null,
    minute: 36,
  },
];

const AUTO_ROOT_ID = agentIdOf({ key: AUTO_KEY });

const AUTO_TREE_ID = brandId<AutoTreeId>({ value: 'mock-one-flow-tree' });

const autoViewOf = (): AutoTreeView => ({
  tree: {
    ...aTree({ phase: 'waiting' satisfies AutoPhase, capUsd: 5 }),
    id: AUTO_TREE_ID,
    rootAgentId: AUTO_ROOT_ID,
    sessionId: SESSION_ID,
  },
  delegations: AUTO_CHILDREN.map((child) => ({
    ...aDelegation({
      key: child.key,
      role: child.role,
      state: child.state,
      outcome: child.outcome,
      settledAt: child.state === 'settled' ? ms({ minute: child.minute + 3 }) : null,
    }),
    treeId: AUTO_TREE_ID,
    childAgentId: agentIdOf({ key: child.key }),
    request: { title: child.title, task: child.title },
    createdAt: ms({ minute: child.minute }),
    deadlineAt: ms({ minute: child.minute + 600 }),
  })),
  artifacts: [],
  budget: autoBudgetOf({
    spend: autoTreeSpendOf({
      capUsd: 5,
      settledUsd: 0.64,
      liveUsd: 0.21,
      reservedUsd: 0,
      estimatedUsd: 0,
    }),
  }),
  pendingRefusal: null,
  deliveredResults: [],
  rootAsk: AUTO_ASK,
});

const AUTO_AGENTS: ReadonlyArray<Agent> = [
  {
    id: AUTO_ROOT_ID,
    sessionId: SESSION_ID,
    ordinal: 8,
    name: 'Auto',
    kind: 'auto',
    status: 'running',
    startedAt: iso({ minute: 32 }),
    lastViewedAt: NOW,
  },
  ...AUTO_CHILDREN.map((child, index): Agent => ({
    id: agentIdOf({ key: child.key }),
    sessionId: SESSION_ID,
    ordinal: 9 + index,
    name: child.title,
    kind: child.role,
    status: child.state === 'settled' ? 'completed' : 'running',
    startedAt: iso({ minute: child.minute }),
    parentAgentId: AUTO_ROOT_ID,
    lastViewedAt: NOW,
  })),
];

type TurnParams = {
  readonly key: string;
  readonly ask: string;
  readonly answer: string;
  readonly minute: number;
  readonly doneMinute: number;
};

const finishedTurn = ({
  key,
  ask,
  answer,
  minute,
  doneMinute,
}: TurnParams): ReadonlyArray<TurnEvent> => {
  const runId = providerRunOf({ key });
  return [
    { kind: 'user_text', runId, text: ask, at: iso({ minute }) },
    { kind: 'assistant_text', runId, delta: answer, at: iso({ minute: doneMinute }) },
    {
      kind: 'usage',
      runId,
      at: iso({ minute: doneMinute }),
      usage: {
        inputTokens: 16200,
        outputTokens: 840,
        cachedInputTokens: 9000,
        estimatedCostUsd: 0.21,
      },
    },
    { kind: 'done', runId, at: iso({ minute: doneMinute }) },
  ];
};

type WorkingParams = {
  readonly key: string;
  readonly ask: string;
  readonly note: string;
  readonly command: string;
  readonly minute: number;
};

const workingTurn = ({
  key,
  ask,
  note,
  command,
  minute,
}: WorkingParams): ReadonlyArray<TurnEvent> => {
  const runId = providerRunOf({ key });
  return [
    { kind: 'user_text', runId, text: ask, at: iso({ minute }) },
    { kind: 'assistant_text', runId, delta: note, at: iso({ minute: minute + 2 }) },
    {
      kind: 'tool_call_start',
      runId,
      toolUseId: `${key}-tool`,
      toolName: 'Bash',
      input: { command },
      at: iso({ minute: minute + 3 }),
    },
  ];
};

const TESTER_ASK = 'Open each member page at 390, 768 and 1440 and say what is off.';

const transcriptsOf = (): Readonly<Record<string, ReadonlyArray<TurnEvent>>> => ({
  [agentIdOf({ key: 'preset-find' })]: finishedTurn({
    key: 'preset-find',
    ask: 'Find every member page layout in harbor-portal.',
    answer:
      'Six member pages share one wrapper, MemberShell, in src/members/MemberShell.tsx. It is pinned to the left at 720px.',
    minute: 1,
    doneMinute: 4,
  }),
  [agentIdOf({ key: 'preset-center' })]: workingTurn({
    key: 'preset-center',
    ask: 'Center the page wrapper.',
    note: 'MemberShell now centers at a 960px measure. Running the layout tests.',
    command: 'pnpm --filter harbor-portal test members',
    minute: 30,
  }),
  [agentIdOf({ key: 'plan-find' })]: finishedTurn({
    key: 'plan-find',
    ask: 'Find every member page layout.',
    answer:
      'Six pages use MemberShell. The billing table has a fixed 880px width and scrolls sideways at 390px.',
    minute: 2,
    doneMinute: 6,
  }),
  [agentIdOf({ key: 'plan-center' })]: finishedTurn({
    key: 'plan-center',
    ask: 'Center the page wrapper.',
    answer: 'MemberShell centers at a 960px measure with 16px gutters. All six pages pick it up.',
    minute: 7,
    doneMinute: 19,
  }),
  [agentIdOf({ key: 'plan-billing' })]: finishedTurn({
    key: 'plan-billing',
    ask: 'Stop the billing table scrolling sideways.',
    answer:
      'The billing table now scrolls inside its own card at 390px. The page no longer scrolls sideways.',
    minute: 20,
    doneMinute: 29,
  }),
  [agentIdOf({ key: 'plan-check' })]: workingTurn({
    key: 'plan-check',
    ask: TESTER_ASK,
    note: 'Profile, plans and team look right at all three widths. Checking billing next.',
    command: 'pnpm --filter harbor-portal test:visual members --widths 390,768,1440',
    minute: 31,
  }),
  [HAND_AGENT_ID]: finishedTurn({
    key: HAND_AGENT.key,
    ask: HAND_AGENT.name,
    answer:
      'All six member pages use MemberShell: profile, billing, plans, team, security and notifications.',
    minute: 0,
    doneMinute: 3,
  }),
  [AUTO_ROOT_ID]: finishedTurn({
    key: AUTO_KEY,
    ask: AUTO_ASK,
    answer:
      'I asked a scout to find the hard coded colors, then an implementer to move billing and team to the theme tokens.',
    minute: 32,
    doneMinute: 33,
  }),
  [agentIdOf({ key: 'auto-scout' })]: finishedTurn({
    key: 'auto-scout',
    ask: 'Find the member pages that hard code a color.',
    answer:
      'Billing and team set a fixed white on their cards. The other four use the theme tokens.',
    minute: 33,
    doneMinute: 36,
  }),
  [agentIdOf({ key: 'auto-fix' })]: workingTurn({
    key: 'auto-fix',
    ask: 'Use the theme tokens on the billing and team pages.',
    note: 'Billing uses the surface token now. Moving the team cards next.',
    command: 'pnpm --filter harbor-portal test members',
    minute: 36,
  }),
});

type TelemetryParams = {
  readonly key: string;
  readonly costUsd: number;
};

const telemetryOf = ({ key, costUsd }: TelemetryParams): TelemetryRecord => ({
  id: brandId<TelemetryRecordId>({ value: `mock-one-flow-telemetry-${key}` }),
  runId: providerRunOf({ key }),
  sessionId: SESSION_ID,
  kind: 'turn',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  inputTokens: 16200,
  outputTokens: 840,
  contextTokens: 48000,
  estimatedCostUsd: costUsd,
  recordedAt: NOW,
});

const TELEMETRY_KEYS: ReadonlyArray<TelemetryParams> = [
  { key: 'preset-find', costUsd: 0.18 },
  { key: 'preset-center', costUsd: 0.34 },
  { key: 'plan-find', costUsd: 0.22 },
  { key: 'plan-center', costUsd: 0.51 },
  { key: 'plan-billing', costUsd: 0.38 },
  { key: 'plan-check', costUsd: 0.19 },
  { key: HAND_AGENT.key, costUsd: 0.09 },
  { key: AUTO_KEY, costUsd: 0.12 },
  { key: 'auto-scout', costUsd: 0.2 },
  { key: 'auto-fix', costUsd: 0.31 },
];

const runningOf = ({ key, minute }: Pick<AgentSpec, 'key' | 'minute'>): TurnState => ({
  kind: 'running',
  runId: providerRunOf({ key }),
  startedAt: iso({ minute }),
});

type SessionParams = EraParams;

const sessionOf = ({ era }: SessionParams): Session => ({
  ...SESSION,
  goal: ONE_FLOW_GOAL,
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [{ key: 'goal', value: ONE_FLOW_GOAL, enabled: true }],
  workflowRuns: era === 'before' ? [PRESET_RUN, planRunOf({ era })] : [planRunOf({ era })],
  titleUserEdited: true,
  createdAt: iso({ minute: -5 }),
  updatedAt: NOW,
});

type PlaceState = Readonly<{
  lens: LensKind | null;
  runId: WorkflowRunId | null;
  agentId: AgentId | null;
}>;

const PLACES: Readonly<Record<OneFlowPlace, PlaceState>> = {
  overview: { lens: null, runId: null, agentId: null },
  preset: { lens: 'workflows', runId: PRESET_RUN_ID, agentId: null },
  orchestrated: { lens: 'workflows', runId: PLAN_RUN_ID, agentId: null },
  agent: { lens: 'agents', runId: null, agentId: HAND_AGENT_ID },
  auto: { lens: 'auto', runId: null, agentId: AUTO_ROOT_ID },
  runs: { lens: 'workflows', runId: null, agentId: null },
};

export type SeedParams = EraParams & {
  readonly place: OneFlowPlace;
  readonly drawerStepKey?: string;
  readonly isJustStarted?: boolean;
};

const STARTED_AGENT: AgentSpec = {
  key: 'plan-find',
  role: 'scout',
  name: 'Find every member page layout',
  status: 'running',
  minute: 39,
  runId: PLAN_RUN_ID,
  stepKey: 'plan-find',
  ordinal: 3,
};

const startedWorkflowOf = (): Workflow => {
  const workflow = planWorkflowOf({ era: 'after' });
  return {
    ...workflow,
    createdAt: iso({ minute: 39 }),
    steps: stepsOf({ workflowId: PLAN_WORKFLOW_ID, steps: PLAN_STEPS_STARTED }),
  };
};

const startedRunOf = (): WorkflowRun => ({
  ...planRunOf({ era: 'after' }),
  currentStep: 0,
  createdAt: iso({ minute: 39 }),
  orchestratorSummary: JSON.stringify({ done: [], left: [] }),
});

const drawerOf = ({ drawerStepKey }: Pick<SeedParams, 'drawerStepKey'>): OpenDrawer | null =>
  drawerStepKey === undefined
    ? null
    : {
        kind: 'run-step',
        sessionId: SESSION_ID,
        payload: { runId: PLAN_RUN_ID, agentId: agentIdOf({ key: drawerStepKey }) },
      };

export const seedOneFlow = ({
  era,
  place,
  drawerStepKey,
  isJustStarted = false,
}: SeedParams): Session => {
  seedActivityRunScene();
  const state = useAppStore.getState();
  const [baseProject] = state.projects;
  const [baseMount] = state.sessionProjectMounts[SESSION_ID] ?? [];
  const baseSession = sessionOf({ era });
  const session = isJustStarted ? { ...baseSession, workflowRuns: [startedRunOf()] } : baseSession;
  const planWorkflow = isJustStarted ? startedWorkflowOf() : planWorkflowOf({ era });
  const planSpecs = isJustStarted ? [STARTED_AGENT] : planAgentsOf({ era });
  const specs: ReadonlyArray<AgentSpec> =
    era === 'before' ? [...PRESET_AGENTS, ...planSpecs, HAND_AGENT] : planSpecs;
  const agents = [...specs.map((spec) => agentOf({ spec })), ...AUTO_AGENTS];
  const running = [...specs, ...AUTO_CHILDREN.map((child) => ({ ...child, status: child.state }))]
    .filter((spec) => spec.status === 'running')
    .map((spec) => [
      agentIdOf({ key: spec.key }),
      runningOf({ key: spec.key, minute: spec.minute }),
    ]);
  const projects =
    baseProject === undefined
      ? []
      : [{ ...baseProject, name: ONE_FLOW_REPO, rootPath: `~/code/harborline/${ONE_FLOW_REPO}` }];
  const mount =
    baseMount === undefined
      ? null
      : {
          ...baseMount,
          mountName: ONE_FLOW_REPO,
          branch: BRANCH,
          repoRoot: `~/code/harborline/${ONE_FLOW_REPO}`,
          worktreePath: `~/code/harborline/${ONE_FLOW_REPO}/.goodboy/worktrees/gb-4m8c2r`,
        };
  const placeState = PLACES[place];
  useAppStore.setState({
    projects,
    sessions: [session],
    currentSessionId: SESSION_ID,
    sessionProjectMounts: { [SESSION_ID]: mount === null ? [] : [mount] },
    sessionActiveMount: { [SESSION_ID]: mount?.mountId ?? null },
    sessionWorktrees: { [SESSION_ID]: mount === null ? [] : [mount.worktreePath] },
    sessionWorktreeRecords: { [SESSION_ID]: [] },
    sessionSlots: { [SESSION_ID]: session.contextSlots },
    sessionDecisions: { [SESSION_ID]: [] },
    sessionContextItems: { [SESSION_ID]: [] },
    sessionPhaseRuns: { [SESSION_ID]: agents },
    sessionOpenQuestions: { [SESSION_ID]: [] },
    sessionAnsweredQuestions: { [SESSION_ID]: [] },
    sessionEvents: { [SESSION_ID]: [] },
    sessionArtifacts: { [SESSION_ID]: [] },
    sessionPlans: { [SESSION_ID]: [] },
    sessionExternalTasks: { [SESSION_ID]: [] },
    sessionGithub: {},
    mountGithub: {},
    sessionProjectPrs: {},
    sessionTurnSpans: { [SESSION_ID]: [] },
    sessionWorkflows: {
      [SESSION_ID]: era === 'before' ? [PRESET, planWorkflow] : [planWorkflow],
    },
    phaseTemplates: { [SESSION.workspaceId]: [PRESET] },
    sessionTelemetry: {
      [SESSION_ID]: TELEMETRY_KEYS.map(({ key, costUsd }) => telemetryOf({ key, costUsd })),
    },
    agentRunHistory: Object.fromEntries(
      [...specs.map((spec) => spec.key), AUTO_KEY, ...AUTO_CHILDREN.map((child) => child.key)].map(
        (key) => [agentIdOf({ key }), [providerRunOf({ key })]],
      ),
    ),
    agentTurnState: Object.fromEntries(running),
    transcripts: transcriptsOf(),
    agentKindOverride: { [AUTO_ROOT_ID]: 'auto' },
    autoTreeViews: { [SESSION_ID]: [autoViewOf()] },
    loadAutoTrees: async () => undefined,
    loadAgentTranscript: async () => undefined,
    loadSessionTelemetry: async () => undefined,
    orchestratingWorkflowRuns: {},
    orchestratorReadingHints: {},
    activeLens: { [SESSION_ID]: placeState.lens },
    focusedWorkflowRunId: { [SESSION_ID]: placeState.runId },
    selectedAgentId: { [SESSION_ID]: placeState.agentId },
    drawer: drawerOf({ drawerStepKey }),
  });
  return session;
};
