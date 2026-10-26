import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type MeasuredTurnSpan,
  type MountId,
  type OpenQuestion,
  type OpenQuestionId,
  type PrCheckRun,
  type Project,
  type ProjectId,
  type ProviderRunId,
  type PullRequestState,
  type SessionEvent,
  type SessionEventId,
  type SessionProjectMount,
  type Step,
  type StepId,
  type TurnEvent,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
} from '@goodboy/types';
import type { WorktreeStatus } from '@goodboy/types';
import { isoNow } from '@goodboy/types/helpers';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { CTX_STATUS } from '../brand/contextBranch';
import { mockSceneIpc } from '../mockSceneIpc';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../activityRunSeed';
import { centralAutoSeedOf } from './centralAutoSeed';

export const COLUMN_SESSION_ID = SESSION_ID;

export type ColumnKind =
  'mid' | 'finished' | 'stuck' | 'blocked' | 'failed' | 'orchestrated' | 'agent' | 'branches';

type SeedParams = {
  readonly kind: ColumnKind;
};

const clock = sceneClock({ anchor: '2026-10-18T10:31:00.000Z' });

type AtParams = {
  readonly day?: number;
  readonly time: string;
};

const at = ({ day = 18, time }: AtParams): IsoDateTime =>
  clock.iso({ at: `2026-10-${day}T${time}:00.000Z` });

const ms = ({ day = 18, time }: AtParams): number =>
  clock.ms({ at: `2026-10-${day}T${time}:00.000Z` });

const GOAL = 'Per-tenant limits on payouts';
const GOAL_LINE =
  'Add per-tenant payout limits to payments-api and show them in the settlement view.';
const SUMMARY_TEXT = [
  '## State',
  '- Limits are enforced on payout creation and the retry fix waits on a review.',
  '- Tests pass in payments-api.',
  '',
  '## Next',
  '- Review the retry fix.',
].join('\n');
const API_BRANCH = 'ak/eng-1190-tenant-limits';
const LEDGER_BRANCH = 'ak/eng-1190-ledger-limits';

const API_PROJECT_ID = brandId<ProjectId>({ value: 'mock-central-project-payments-api' });
const LEDGER_PROJECT_ID = brandId<ProjectId>({ value: 'mock-central-project-ledger-core' });
const API_MOUNT_ID = brandId<MountId>({ value: 'mock-central-mount-payments-api' });
const LEDGER_MOUNT_ID = brandId<MountId>({ value: 'mock-central-mount-ledger-core' });

type MountParams = {
  readonly mountId: MountId;
  readonly projectId: ProjectId;
  readonly name: string;
  readonly branch: string;
};

const mountOf = ({ mountId, projectId, name, branch }: MountParams): SessionProjectMount => ({
  mountId,
  sessionId: SESSION_ID,
  projectId,
  mountName: name,
  worktreePath: `/w/harborline/${name}`,
  lastWorktreePath: null,
  repoRoot: `/w/harborline/${name}`,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const API_MOUNT = mountOf({
  mountId: API_MOUNT_ID,
  projectId: API_PROJECT_ID,
  name: 'payments-api',
  branch: API_BRANCH,
});

const LEDGER_MOUNT = mountOf({
  mountId: LEDGER_MOUNT_ID,
  projectId: LEDGER_PROJECT_ID,
  name: 'ledger-core',
  branch: LEDGER_BRANCH,
});

const BEHIND_STATUS: WorktreeStatus = {
  ...CTX_STATUS,
  mainDistance: { kind: 'known', ahead: 3, behind: 6 },
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
};

const CURRENT_STATUS: WorktreeStatus = {
  ...BEHIND_STATUS,
  mainDistance: { kind: 'known', ahead: 3, behind: 0 },
};

const WORKFLOW_ID = brandId<WorkflowId>({ value: 'mock-central-workflow-build' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'mock-central-run-build' });
const ORCH_WORKFLOW_ID = brandId<WorkflowId>({ value: 'mock-central-workflow-orchestrated' });
const ORCH_RUN_ID = brandId<WorkflowRunId>({ value: 'mock-central-run-orchestrated' });

const BUILD_STEP_NAMES = ['Scope', 'Tests first', 'Implement', 'Review', 'Update docs', 'Push'];
const ORCH_STEP_NAMES = ['Map the payout code', 'Write the limit plan', 'Build the limit table'];

type StepsParams = {
  readonly workflowId: WorkflowId;
  readonly prefix: string;
  readonly names: ReadonlyArray<string>;
};

type StepIdParams = {
  readonly prefix: string;
  readonly index: number;
};

const stepIdOf = ({ prefix, index }: StepIdParams): StepId =>
  brandId<StepId>({ value: `mock-central-${prefix}-step-${index}` });

const stepsOf = ({ workflowId, prefix, names }: StepsParams): ReadonlyArray<Step> =>
  names.map((name, index) => ({
    id: stepIdOf({ prefix, index }),
    workflowId,
    ordinal: index,
    name,
    promptPrefix: '',
  }));

const BUILD: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: SESSION.workspaceId,
  name: 'Build',
  description: 'Scope, test, implement, review, document and push.',
  origin: 'library',
  steps: stepsOf({ workflowId: WORKFLOW_ID, prefix: 'build', names: BUILD_STEP_NAMES }),
  createdAt: at({ day: 16, time: '09:00' }),
  updatedAt: at({ day: 16, time: '09:00' }),
};

const ORCHESTRATED: Workflow = {
  id: ORCH_WORKFLOW_ID,
  workspaceId: SESSION.workspaceId,
  name: 'Orchestrated',
  description: 'Steps the orchestrator decides one at a time.',
  origin: 'orchestrated',
  steps: stepsOf({ workflowId: ORCH_WORKFLOW_ID, prefix: 'orch', names: ORCH_STEP_NAMES }),
  createdAt: at({ time: '09:30' }),
  updatedAt: at({ time: '09:30' }),
};

type RunParams = {
  readonly id: WorkflowRunId;
  readonly workflowId: WorkflowId;
  readonly title: string;
  readonly currentStep: number;
  readonly executionMode: WorkflowRun['executionMode'];
  readonly createdAt: IsoDateTime;
};

const runOf = ({
  id,
  workflowId,
  title,
  currentStep,
  executionMode,
  createdAt,
}: RunParams): WorkflowRun => ({
  id,
  workflowId,
  ordinal: 0,
  currentStep,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode,
  title,
  goal: GOAL,
  createdAt,
});

type KeyParams = {
  readonly key: string;
};

const agentId = ({ key }: KeyParams): AgentId =>
  brandId<AgentId>({ value: `mock-central-agent-${key}` });

const runIdOf = ({ key }: KeyParams): ProviderRunId =>
  brandId<ProviderRunId>({ value: `mock-central-provider-run-${key}` });

type AgentParams = {
  readonly key: string;
  readonly name: string;
  readonly kind: string;
  readonly status: Agent['status'];
  readonly ordinal: number;
  readonly startedAt?: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly stepId?: StepId;
  readonly workflowRunId?: WorkflowRunId;
  readonly mountId?: MountId;
  readonly outputSummary?: string;
};

const agentOf = ({
  key,
  name,
  kind,
  status,
  ordinal,
  startedAt,
  completedAt,
  stepId,
  workflowRunId,
  mountId,
  outputSummary,
}: AgentParams): Agent => ({
  id: agentId({ key }),
  sessionId: SESSION_ID,
  ordinal,
  name,
  kind,
  status,
  ...(status === 'pending' ? {} : { runId: runIdOf({ key }) }),
  ...(startedAt === undefined ? {} : { startedAt }),
  ...(completedAt === undefined ? {} : { completedAt }),
  ...(stepId === undefined ? {} : { stepId }),
  ...(workflowRunId === undefined ? {} : { workflowRunId }),
  ...(mountId === undefined ? {} : { mountId }),
  ...(outputSummary === undefined ? {} : { outputSummary }),
});

const HISTORY_AGENTS: ReadonlyArray<Agent> = [
  agentOf({
    key: 'planner',
    name: 'Plan the payout limits',
    kind: 'planner',
    status: 'completed',
    ordinal: 1,
    startedAt: at({ day: 16, time: '15:02' }),
    completedAt: at({ day: 16, time: '16:20' }),
  }),
  agentOf({
    key: 'scribe',
    name: 'Summarise the plan',
    kind: 'scribe',
    status: 'completed',
    ordinal: 2,
    startedAt: at({ time: '09:38' }),
    completedAt: at({ time: '09:40' }),
  }),
];

const HISTORY_EVENTS: ReadonlyArray<SessionEvent> = [
  {
    id: brandId<SessionEventId>({ value: 'mock-central-event-rebase-asked' }),
    sessionId: SESSION_ID,
    kind: 'rebase_requested',
    payload: { branch: 'main', projectName: 'payments-api' },
    createdAt: at({ time: '09:04' }),
  },
  {
    id: brandId<SessionEventId>({ value: 'mock-central-event-rebase-done' }),
    sessionId: SESSION_ID,
    kind: 'history_rewritten',
    payload: { origin: 'rebase', branch: API_BRANCH, projectName: 'payments-api' },
    createdAt: at({ time: '09:12' }),
  },
];

type BuildParams = {
  readonly isFinished: boolean;
};

const buildAgents = ({ isFinished }: BuildParams): ReadonlyArray<Agent> => [
  agentOf({
    key: 'build-1',
    name: 'Scope the change',
    kind: 'scout',
    status: 'completed',
    ordinal: 10,
    stepId: stepIdOf({ prefix: 'build', index: 0 }),
    workflowRunId: RUN_ID,
    mountId: API_MOUNT_ID,
    outputSummary: 'Mapped the payout limits in payments-api.',
    startedAt: at({ time: '09:50' }),
    completedAt: at({ time: '09:55' }),
  }),
  agentOf({
    key: 'build-2',
    name: 'Write the tests first',
    kind: 'tester',
    status: 'completed',
    ordinal: 11,
    stepId: stepIdOf({ prefix: 'build', index: 1 }),
    workflowRunId: RUN_ID,
    mountId: API_MOUNT_ID,
    outputSummary: 'Scoped the change and wrote the tests first. Two of them fail on purpose.',
    startedAt: at({ time: '10:10' }),
    completedAt: at({ time: '10:19' }),
  }),
  agentOf({
    key: 'build-3',
    name: 'Add the limit check to payout creation',
    kind: 'implementer',
    status: isFinished ? 'completed' : 'running',
    ordinal: 12,
    stepId: stepIdOf({ prefix: 'build', index: 2 }),
    workflowRunId: RUN_ID,
    mountId: API_MOUNT_ID,
    startedAt: at({ time: '10:19' }),
    ...(isFinished ? { completedAt: at({ time: '10:21' }) } : {}),
  }),
  ...(isFinished
    ? [
        agentOf({
          key: 'build-4',
          name: 'Review the limit check',
          kind: 'reviewer',
          status: 'completed',
          ordinal: 13,
          stepId: stepIdOf({ prefix: 'build', index: 3 }),
          workflowRunId: RUN_ID,
          mountId: API_MOUNT_ID,
          outputSummary: 'Reviewed the limit check. No blocking findings.',
          startedAt: at({ time: '10:21' }),
          completedAt: at({ time: '10:23' }),
        }),
        ...[4, 5].map((index) =>
          agentOf({
            key: `build-${index + 1}`,
            name: index === 4 ? 'Update the payout docs' : 'Push the branch',
            kind: index === 4 ? 'scribe' : 'implementer',
            status: 'completed',
            ordinal: 12 + index,
            stepId: stepIdOf({ prefix: 'build', index }),
            workflowRunId: RUN_ID,
            mountId: API_MOUNT_ID,
            outputSummary: index === 4 ? 'Documented the limits.' : 'Pushed the branch.',
            startedAt: at({ time: `10:${23 + (index - 4) * 2}` }),
            completedAt: at({ time: `10:${25 + (index - 4) * 2}` }),
          }),
        ),
        {
          ...agentOf({
            key: 'ci-fix',
            name: 'Fix the static-analysis check',
            kind: 'ci-debugger',
            status: 'completed',
            ordinal: 14,
            mountId: API_MOUNT_ID,
            outputSummary: 'Fixed the failing static-analysis check.',
            startedAt: at({ time: '10:28' }),
            completedAt: at({ time: '10:29' }),
          }),
          lastFinishedAt: at({ time: '10:29' }),
        },
      ]
    : []),
];

const orchestratedAgents = (): ReadonlyArray<Agent> =>
  ORCH_STEP_NAMES.map((name, index) =>
    agentOf({
      key: `orch-${index + 1}`,
      name,
      kind: index === 0 ? 'scout' : index === 1 ? 'planner' : 'implementer',
      status: 'completed',
      ordinal: 20 + index,
      stepId: stepIdOf({ prefix: 'orch', index }),
      workflowRunId: ORCH_RUN_ID,
      mountId: API_MOUNT_ID,
      outputSummary: `${name}.`,
      startedAt: at({ time: `10:${String(2 + index * 8).padStart(2, '0')}` }),
      completedAt: at({ time: `10:${String(9 + index * 8).padStart(2, '0')}` }),
    }),
  );

const standaloneAgent = (): Agent => ({
  ...agentOf({
    key: 'standalone',
    name: 'Add the limit table',
    kind: 'implementer',
    status: 'running',
    ordinal: 30,
    mountId: API_MOUNT_ID,
    startedAt: at({ time: '10:19' }),
  }),
  modelOverride: 'claude-opus-5-5',
  effort: 'high',
});

const CAP_QUESTION: OpenQuestion = {
  id: brandId<OpenQuestionId>({ value: 'mock-central-question-cap' }),
  sessionId: SESSION_ID,
  text: 'Cap per day or per payout?',
  suggestedAnswers: ['Per day', 'Per payout'],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdByAgentId: agentId({ key: 'build-3' }),
  createdAt: at({ time: '10:26' }),
};

const PERMISSION_RUN = runIdOf({ key: 'standalone' });

const PERMISSION_EVENTS: ReadonlyArray<TurnEvent> = [
  {
    kind: 'permission_request',
    runId: PERMISSION_RUN,
    toolUseId: 'mock-central-tool-use',
    toolName: 'Bash',
    input: { command: 'pnpm test payouts' },
    at: at({ time: '10:29' }),
  },
];

const CHECKS: ReadonlyArray<PrCheckRun> = [
  ...Array.from({ length: 9 }, (_, index) => ({
    name: `check ${index + 1}`,
    conclusion: 'success' as const,
    detailsUrl: null,
    durationMs: 60_000,
  })),
  {
    name: 'static-analysis',
    conclusion: 'failure',
    detailsUrl: 'https://example.invalid/harborline/payments-api/actions/runs/309/job/1',
    durationMs: 79_000,
  },
];

const PASSED: ReadonlyArray<PrCheckRun> = [
  ...Array.from({ length: 11 }, (_, index) => ({
    name: `check ${index + 1}`,
    conclusion: 'success' as const,
    detailsUrl: null,
    durationMs: 60_000,
  })),
  {
    name: 'static-analysis',
    conclusion: 'success',
    detailsUrl: null,
    durationMs: 79_000,
  },
];

type PrParams = {
  readonly checks: PullRequestState['checks'];
};

const prOf = ({ checks }: PrParams): PullRequestState => ({
  number: 309,
  title: GOAL,
  url: 'https://example.invalid/harborline/payments-api/pull/309',
  headSha: 'a41c9e2b7d3f',
  headBranch: API_BRANCH,
  baseBranch: 'main',
  checks,
  state: 'open',
  isDraft: true,
  mergeable: true,
  reviewDecision: null,
  body: '',
  updatedAt: isoNow(),
});

type GithubParams = {
  readonly pr: PullRequestState;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

const githubOf = ({ pr, checks }: GithubParams) => {
  const fetchedAt = isoNow();
  return {
    pr,
    linkedIssues: [],
    fetchedAt,
    failedAt: null,
    loading: false,
    error: null,
    detail: { prNumber: pr.number, comments: [], reviews: [], reviewRequests: [], checks },
    detailFetchedAt: fetchedAt,
    detailLoading: false,
    detailError: null,
  };
};

const LEDGER_MR = {
  id: 4200,
  iid: 42,
  projectId: 77,
  title: 'Add the ledger limit table',
  description: null,
  state: 'opened',
  webUrl: 'https://example.invalid/harborline/ledger-core/-/merge_requests/42',
  sourceBranch: LEDGER_BRANCH,
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged' as const,
  updatedAt: new Date().toISOString(),
  sha: 'b72d0e1c8a49',
  detailedMergeStatus: 'mergeable',
  headPipeline: { id: 9001, status: 'success' },
};

type LedgerProjectParams = {
  readonly template: Project;
};

const ledgerProjectOf = ({ template }: LedgerProjectParams): Project => ({
  ...template,
  id: LEDGER_PROJECT_ID,
  name: 'ledger-core',
});

type SessionParams = {
  readonly kind: ColumnKind;
  readonly runs: ReadonlyArray<WorkflowRun>;
};

const sessionOf = ({ kind, runs }: SessionParams) => ({
  ...SESSION,
  goal: GOAL,
  state:
    kind === 'finished'
      ? { kind: 'idle' as const, lastActivityAt: at({ time: '10:29' }) }
      : SESSION.state,
  workflowRuns: runs,
});

type SpanParams = {
  readonly agent: Agent;
};

const spanOf = ({ agent }: SpanParams): MeasuredTurnSpan => ({
  agentId: agent.id,
  parentAgentId: null,
  agentStatus: agent.status,
  workflowRunId: agent.workflowRunId ?? null,
  isOrchestratedRunDone: false,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: 'medium',
  startedAtMs: Date.parse(agent.startedAt ?? at({ time: '10:00' })),
  endedAtMs: Date.parse(agent.completedAt ?? at({ time: '10:31' })),
  endReason: 'succeeded',
  costUsd: null,
  touchedMountIds: null,
});

type AutoParts = {
  readonly view: AutoTreeView;
  readonly agents: ReadonlyArray<Agent>;
  readonly spans: ReadonlyArray<MeasuredTurnSpan>;
};

type AutoPartsParams = {
  readonly variant: 'working' | 'stuck' | 'blocked' | 'failed';
};

const autoPartsOf = ({ variant }: AutoPartsParams): AutoParts => {
  const seed = centralAutoSeedOf({ variant });
  return {
    view: { ...seed.view, tree: { ...seed.view.tree, sessionId: SESSION_ID } },
    agents: seed.agents.map((agent) => ({
      ...agent,
      sessionId: SESSION_ID,
      ordinal: agent.ordinal + 40,
    })),
    spans: seed.source.spans,
  };
};

type Parts = {
  readonly agents: ReadonlyArray<Agent>;
  readonly workflows: ReadonlyArray<Workflow>;
  readonly runs: ReadonlyArray<WorkflowRun>;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly extraSpans: ReadonlyArray<MeasuredTurnSpan>;
  readonly pr: PullRequestState | null;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly isDeciding: boolean;
  readonly transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  readonly runningIds: ReadonlyArray<AgentId>;
  readonly blockedIds: ReadonlyArray<AgentId>;
};

const NO_PARTS: Parts = {
  agents: [],
  workflows: [],
  runs: [],
  questions: [],
  views: [],
  extraSpans: [],
  pr: null,
  checks: [],
  mounts: [API_MOUNT],
  isDeciding: false,
  transcripts: {},
  runningIds: [],
  blockedIds: [],
};

type BuildRunParams = {
  readonly currentStep: number;
};

const buildRun = ({ currentStep }: BuildRunParams): WorkflowRun =>
  runOf({
    id: RUN_ID,
    workflowId: WORKFLOW_ID,
    title: 'Build',
    currentStep,
    executionMode: 'static',
    createdAt: at({ time: '09:45' }),
  });

const partsOf = ({ kind }: SeedParams): Parts => {
  switch (kind) {
    case 'mid': {
      const auto = autoPartsOf({ variant: 'working' });
      const agents = buildAgents({ isFinished: false });
      return {
        ...NO_PARTS,
        agents: [...agents, ...auto.agents],
        workflows: [BUILD],
        runs: [buildRun({ currentStep: 2 })],
        questions: [CAP_QUESTION],
        views: [auto.view],
        extraSpans: auto.spans,
        pr: prOf({ checks: 'failure' }),
        checks: CHECKS,
        runningIds: [
          agentId({ key: 'build-3' }),
          ...auto.agents.filter((agent) => agent.status === 'running').map((agent) => agent.id),
        ],
      };
    }
    case 'finished':
      return {
        ...NO_PARTS,
        agents: buildAgents({ isFinished: true }),
        workflows: [BUILD],
        runs: [buildRun({ currentStep: 5 })],
        pr: prOf({ checks: 'success' }),
        checks: PASSED,
      };
    case 'stuck':
    case 'blocked':
    case 'failed': {
      const auto = autoPartsOf({ variant: kind });
      return {
        ...NO_PARTS,
        agents: auto.agents,
        views: [auto.view],
        extraSpans: auto.spans,
        pr: prOf({ checks: 'pending' }),
        runningIds: auto.agents
          .filter((agent) => agent.status === 'running')
          .map((agent) => agent.id),
      };
    }
    case 'orchestrated':
      return {
        ...NO_PARTS,
        agents: orchestratedAgents(),
        workflows: [ORCHESTRATED],
        runs: [
          runOf({
            id: ORCH_RUN_ID,
            workflowId: ORCH_WORKFLOW_ID,
            title: 'Payout limits',
            currentStep: 3,
            executionMode: 'dynamic',
            createdAt: at({ time: '10:00' }),
          }),
        ],
        pr: prOf({ checks: 'pending' }),
        isDeciding: true,
      };
    case 'agent': {
      const agent = standaloneAgent();
      return {
        ...NO_PARTS,
        agents: [agent],
        pr: prOf({ checks: 'pending' }),
        runningIds: [],
        blockedIds: [agent.id],
        transcripts: { [agent.id]: PERMISSION_EVENTS },
      };
    }
    case 'branches': {
      const agents = buildAgents({ isFinished: false });
      const ledgerAgent: Agent = {
        ...agentOf({
          key: 'ledger-implementer',
          name: 'Add the limit table',
          kind: 'implementer',
          status: 'running',
          ordinal: 31,
          mountId: LEDGER_MOUNT_ID,
          startedAt: at({ time: '10:22' }),
        }),
      };
      return {
        ...NO_PARTS,
        agents: [...agents, ledgerAgent],
        workflows: [BUILD],
        runs: [buildRun({ currentStep: 2 })],
        questions: [CAP_QUESTION],
        pr: prOf({ checks: 'failure' }),
        checks: CHECKS,
        mounts: [API_MOUNT, LEDGER_MOUNT],
        runningIds: [agentId({ key: 'build-3' }), ledgerAgent.id],
      };
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

export const seedCentralColumn = ({ kind }: SeedParams): void => {
  seedActivityRunScene();
  const parts = partsOf({ kind });
  const template = useAppStore.getState().projects[0];
  if (template === undefined) {
    throw new Error('The column scene needs the seeded project.');
  }
  const apiProject: Project = { ...template, id: API_PROJECT_ID, name: 'payments-api' };
  const projects =
    parts.mounts.length > 1 ? [apiProject, ledgerProjectOf({ template })] : [apiProject];
  const agents: ReadonlyArray<Agent> = [...HISTORY_AGENTS, ...parts.agents];
  const spans: ReadonlyArray<MeasuredTurnSpan> = [
    ...parts.agents
      .filter((agent) => agent.workflowRunId !== undefined && agent.startedAt !== undefined)
      .map((agent) => spanOf({ agent })),
    ...parts.extraSpans,
  ];
  const session = sessionOf({ kind, runs: parts.runs });
  const status = kind === 'mid' || kind === 'branches' ? BEHIND_STATUS : CURRENT_STATUS;
  mockSceneIpc((command, payload) => {
    if (command !== 'worktree_status') {
      return null;
    }
    return JSON.stringify(payload ?? {}).includes('ledger-core') ? CURRENT_STATUS : status;
  });
  const github = parts.pr === null ? null : githubOf({ pr: parts.pr, checks: parts.checks });
  const hasLedger = parts.mounts.length > 1;
  useAppStore.setState({
    projects,
    sessions: [session],
    currentSessionId: SESSION_ID,
    sessionSlots: {
      [SESSION_ID]: [
        { key: 'goal', value: GOAL_LINE, enabled: true },
        { key: 'last_output_summary', value: SUMMARY_TEXT, enabled: true },
      ],
    },
    slotHistory: {
      [SESSION_ID]: {
        last_output_summary: [
          {
            id: 'mock-central-summary-1',
            key: 'last_output_summary',
            value: SUMMARY_TEXT,
            author: 'summarizer',
            createdAt: at({ time: '10:30' }),
          },
        ],
      },
    },
    sessionSlotsLoad: { [SESSION_ID]: 'loaded' },
    sessionProjectMounts: { [SESSION_ID]: parts.mounts },
    sessionActiveProject: { [SESSION_ID]: API_PROJECT_ID },
    sessionActiveMount: { [SESSION_ID]: API_MOUNT_ID },
    sessionWorktrees: { [SESSION_ID]: parts.mounts.map((mount) => mount.worktreePath) },
    sessionWorktreeRecords: { [SESSION_ID]: [] },
    sessionPhaseRuns: { [SESSION_ID]: agents },
    sessionWorkflows: { [SESSION_ID]: parts.workflows },
    phaseTemplates: { [SESSION.workspaceId]: parts.workflows },
    sessionEvents: { [SESSION_ID]: HISTORY_EVENTS },
    sessionOpenQuestions: { [SESSION_ID]: parts.questions },
    sessionAnsweredQuestions: { [SESSION_ID]: [] },
    sessionDismissedQuestions: { [SESSION_ID]: [] },
    sessionArtifacts: { [SESSION_ID]: [] },
    sessionPlans: { [SESSION_ID]: [] },
    sessionContextItems: { [SESSION_ID]: [] },
    sessionExternalTasks: { [SESSION_ID]: [] },
    resolveQueueView: {},
    sessionResolveQueueItems: {},
    transcripts: parts.transcripts,
    agentTurnState: Object.fromEntries([
      ...parts.runningIds.map((id) => [
        id,
        { kind: 'running', runId: runIdOf({ key: 'live' }), startedAt: at({ time: '10:19' }) },
      ]),
      ...parts.blockedIds.map((id) => [
        id,
        { kind: 'blocked', runId: PERMISSION_RUN, blockedAt: at({ time: '10:29' }) },
      ]),
    ]),
    orchestratingWorkflowRuns: parts.isDeciding ? { [ORCH_RUN_ID]: true } : {},
    sessionTurnSpans: { [SESSION_ID]: spans },
    sessionTelemetry: { [SESSION_ID]: [] },
    sessionGithub: github === null ? {} : { [SESSION_ID]: github },
    mountGithub:
      github === null
        ? {}
        : {
            [API_MOUNT_ID]: {
              ...github,
              mountId: API_MOUNT_ID,
              projectId: API_PROJECT_ID,
              revision: 0,
              repository: 'harborline/payments-api',
              host: 'github.com',
              branch: API_BRANCH,
              prs: [github.pr],
              links: [],
            },
          },
    mountGitlabMr: hasLedger
      ? {
          [LEDGER_MOUNT_ID]: {
            mountId: LEDGER_MOUNT_ID,
            projectId: LEDGER_PROJECT_ID,
            revision: 0,
            host: 'https://gitlab.com',
            projectPath: 'harborline/ledger-core',
            branch: LEDGER_BRANCH,
            mrs: [LEDGER_MR],
            links: [],
            mr: LEDGER_MR,
            approvals: null,
            fetchedAt: isoNow(),
            loading: false,
            error: null,
          },
        }
      : {},
    mountBitbucketPr: {},
    sessionProjectPrs: {},
    autoTreeViews: { [SESSION_ID]: parts.views },
    loadAutoTrees: async () => undefined,
    loadSessionMounts: async () => [],
    loadSessionTurnSpans: async () => undefined,
    loadWorkspaceDurationHistory: async () => undefined,
    selectedAgentId: {},
    activeLens: { [SESSION_ID]: null },
    drawer: null,
  });
};
