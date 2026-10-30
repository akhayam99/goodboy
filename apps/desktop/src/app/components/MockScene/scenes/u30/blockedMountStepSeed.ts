import {
  DEFAULT_WORKFLOW_RULES,
  brandId,
  type Agent,
  type AgentId,
  type MountId,
  type OrchestratorHint,
  type Project,
  type ProjectId,
  type ProviderRunId,
  type Session,
  type SessionId,
  type SessionMountView,
  type Step,
  type StepId,
  type TurnEvent,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
  type Workspace,
  type WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { applyMountViews } from '../../../../../store/slices/project-mounts/mountViews';
import { sceneClock } from '../../sceneClock';

const clock = sceneClock({ anchor: '2026-10-29T15:12:00.000Z' });

type AtParams = {
  readonly minute: string;
};

const at = ({ minute }: AtParams) => clock.iso({ at: `2026-10-29T15:${minute}.000Z` });

export const BLOCKED_MOUNT_WORKSPACE_ID = brandId<WorkspaceId>({ value: 'mock-u30-bm-workspace' });
export const BLOCKED_MOUNT_SESSION_ID = brandId<SessionId>({ value: 'mock-u30-bm-session' });
export const BLOCKED_MOUNT_RUN_ID = brandId<WorkflowRunId>({ value: 'mock-u30-bm-run' });
export const BLOCKED_MOUNT_AGENT_ID = brandId<AgentId>({ value: 'mock-u30-bm-cover-refunds' });
export const BLOCKED_MOUNT_A = brandId<MountId>({ value: 'mock-u30-bm-mount-refactor' });
export const BLOCKED_MOUNT_B = brandId<MountId>({ value: 'mock-u30-bm-mount-fix' });
export const BLOCKED_BRANCH_A = 'ak/refactor-ledger';
export const BLOCKED_BRANCH_B = 'ak/fix-notify-relay';

const PROJECT_ID = brandId<ProjectId>({ value: 'mock-u30-bm-project-ledger-core' });
const WORKFLOW_ID = brandId<WorkflowId>({ value: 'mock-u30-bm-workflow' });
const SCOUT_STEP = brandId<StepId>({ value: 'mock-u30-bm-step-scout' });
const BATCH_STEP = brandId<StepId>({ value: 'mock-u30-bm-step-batch' });
const REFUNDS_STEP = brandId<StepId>({ value: 'mock-u30-bm-step-refunds' });
const SCOUT_ID = brandId<AgentId>({ value: 'mock-u30-bm-scout' });
const BATCH_ID = brandId<AgentId>({ value: 'mock-u30-bm-batch' });
const SCOUT_RUN = brandId<ProviderRunId>({ value: 'mock-u30-bm-provider-scout' });
const BATCH_RUN = brandId<ProviderRunId>({ value: 'mock-u30-bm-provider-batch' });
const NOW = at({ minute: '12:00' });

const OVERRIDES = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
  defaultBranchTemplate: null,
};

const WORKSPACE: Workspace = {
  id: BLOCKED_MOUNT_WORKSPACE_ID,
  name: 'Northwind',
  slug: 'northwind',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

const PROJECT: Project = {
  id: PROJECT_ID,
  workspaceId: BLOCKED_MOUNT_WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '~/code/northwind/ledger-core',
  kind: 'repo',
  overrides: OVERRIDES,
  createdAt: NOW,
  updatedAt: NOW,
};

type MountParams = {
  readonly id: MountId;
  readonly branch: string;
  readonly isAttached: boolean;
  readonly parallelIndex: number;
};

type PathParams = {
  readonly id: MountId;
};

const pathOf = ({ id }: PathParams): string =>
  `~/code/northwind/ledger-core/.goodboy/worktrees/${id}`;

const mountOf = ({ id, branch, isAttached, parallelIndex }: MountParams): SessionMountView => ({
  id,
  sessionId: BLOCKED_MOUNT_SESSION_ID,
  projectId: PROJECT_ID,
  worktreePath: isAttached ? pathOf({ id }) : null,
  lastWorktreePath: pathOf({ id }),
  branch,
  baseBranch: 'main',
  parallelIndex,
  mountName: 'ledger-core',
  repoSlug: null,
  isAttached,
  diskState: 'present',
  revision: 4,
  createdAt: at({ minute: '00:00' }),
  updatedAt: at({ minute: '09:30' }),
  repoRoot: '~/code/northwind/ledger-core',
});

const MOUNTS: ReadonlyArray<SessionMountView> = [
  mountOf({ id: BLOCKED_MOUNT_A, branch: BLOCKED_BRANCH_A, isAttached: false, parallelIndex: 1 }),
  mountOf({ id: BLOCKED_MOUNT_B, branch: BLOCKED_BRANCH_B, isAttached: true, parallelIndex: 2 }),
];

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

const STEPS: ReadonlyArray<Step> = [
  stepOf({
    id: SCOUT_STEP,
    ordinal: 0,
    name: 'Find where the export spends its time',
    role: 'scout',
    reason: 'Nobody knows yet where the 10k row export loses its time.',
  }),
  stepOf({
    id: BATCH_STEP,
    ordinal: 1,
    name: 'Batch the row reads',
    role: 'implementer',
    reason: 'The scout found one query per row.',
  }),
  stepOf({
    id: REFUNDS_STEP,
    ordinal: 2,
    name: 'Cover refunds with the same batching',
    role: 'implementer',
    reason: 'Refunds read the same rows, so they need the same batching.',
  }),
];

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: BLOCKED_MOUNT_WORKSPACE_ID,
  name: 'Speed up the export end to end',
  description: '',
  origin: 'orchestrated',
  processText: 'Prefer small steps. Measure before and after every change.',
  steps: STEPS,
  createdAt: at({ minute: '00:00' }),
  updatedAt: at({ minute: '00:00' }),
};

const QUEUED_HINT: OrchestratorHint = {
  id: 'mock-u30-bm-hint-chargebacks',
  text: 'Also cover the chargebacks.',
  createdAt: at({ minute: '11:40' }),
};

const READ_HINT: OrchestratorHint = {
  id: 'mock-u30-bm-hint-refunds',
  text: 'Refunds read the same rows, cover them too.',
  createdAt: at({ minute: '10:30' }),
  consumedAt: at({ minute: '10:50' }),
  consumedAtStep: 3,
};

const SUMMARY = JSON.stringify({
  done: ['Found one query per row in the export', 'Batched the row reads in payments-api'],
  left: [{ text: 'Cover chargebacks', role: 'implementer' }],
});

const RUN: WorkflowRun = {
  id: BLOCKED_MOUNT_RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 2,
  currentStep: 2,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  title: 'Speed up the export end to end',
  goal: 'The ledger export times out over 10k rows. Make a 12,000 row export finish in under 5 seconds without changing the CSV it writes.',
  createdAt: at({ minute: '01:00' }),
  providerPool: ['anthropic', 'codex'],
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' },
  orchestratorHints: [READ_HINT, QUEUED_HINT],
  orchestratorSummary: SUMMARY,
};

type AgentParams = {
  readonly id: AgentId;
  readonly stepId: StepId;
  readonly ordinal: number;
  readonly name: string;
  readonly kind: string;
  readonly status: Agent['status'];
  readonly startedMinute?: string;
  readonly completedMinute?: string;
};

const agentOf = ({
  id,
  stepId,
  ordinal,
  name,
  kind,
  status,
  startedMinute,
  completedMinute,
}: AgentParams): Agent => ({
  id,
  sessionId: BLOCKED_MOUNT_SESSION_ID,
  workflowRunId: BLOCKED_MOUNT_RUN_ID,
  stepId,
  ordinal,
  name,
  kind,
  status,
  mountId: BLOCKED_MOUNT_A,
  providerOverride: 'anthropic',
  modelOverride: 'claude-sonnet-5-5',
  effort: 'high',
  ...(startedMinute === undefined ? {} : { startedAt: at({ minute: startedMinute }) }),
  ...(completedMinute === undefined ? {} : { completedAt: at({ minute: completedMinute }) }),
});

const AGENTS: ReadonlyArray<Agent> = [
  agentOf({
    id: SCOUT_ID,
    stepId: SCOUT_STEP,
    ordinal: 0,
    name: STEPS[0]!.name,
    kind: 'scout',
    status: 'completed',
    startedMinute: '01:00',
    completedMinute: '03:20',
  }),
  agentOf({
    id: BATCH_ID,
    stepId: BATCH_STEP,
    ordinal: 1,
    name: STEPS[1]!.name,
    kind: 'implementer',
    status: 'completed',
    startedMinute: '03:40',
    completedMinute: '09:10',
  }),
  agentOf({
    id: BLOCKED_MOUNT_AGENT_ID,
    stepId: REFUNDS_STEP,
    ordinal: 2,
    name: STEPS[2]!.name,
    kind: 'implementer',
    status: 'blocked',
  }),
];

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
  { kind: 'user_text', runId, text: user, at: at({ minute: startMinute }) },
  { kind: 'assistant_text', runId, delta: answer, at: at({ minute: endMinute }) },
  { kind: 'done', runId, at: at({ minute: endMinute }) },
];

const SESSION: Session = {
  id: BLOCKED_MOUNT_SESSION_ID,
  workspaceId: BLOCKED_MOUNT_WORKSPACE_ID,
  goal: 'Ledger export speed up',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [RUN],
  autoRun: false,
  titleUserEdited: true,
  createdAt: at({ minute: '00:00' }),
  updatedAt: NOW,
};

export const seedBlockedMountStep = (): Session => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    projects: [PROJECT],
    currentWorkspaceId: BLOCKED_MOUNT_WORKSPACE_ID,
    sessions: [SESSION],
    currentSessionId: BLOCKED_MOUNT_SESSION_ID,
    activeLens: { [BLOCKED_MOUNT_SESSION_ID]: 'workflows' },
    focusedWorkflowRunId: { [BLOCKED_MOUNT_SESSION_ID]: BLOCKED_MOUNT_RUN_ID },
    selectedAgentId: { [BLOCKED_MOUNT_SESSION_ID]: null },
    sessionWorkflows: { [BLOCKED_MOUNT_SESSION_ID]: [WORKFLOW] },
    phaseTemplates: { [BLOCKED_MOUNT_WORKSPACE_ID]: [] },
    sessionPhaseRuns: { [BLOCKED_MOUNT_SESSION_ID]: AGENTS },
    sessionTelemetry: { [BLOCKED_MOUNT_SESSION_ID]: [] },
    agentRunHistory: { [SCOUT_ID]: [SCOUT_RUN], [BATCH_ID]: [BATCH_RUN] },
    agentTurnState: { [BLOCKED_MOUNT_AGENT_ID]: { kind: 'idle', lastActivityAt: NOW } },
    transcripts: {
      [SCOUT_ID]: finishedTurn({
        runId: SCOUT_RUN,
        user: 'Find where the export spends its time.',
        answer: 'The export runs one query per row. 10,000 rows means 10,000 round trips.',
        startMinute: '01:00',
        endMinute: '03:20',
      }),
      [BATCH_ID]: finishedTurn({
        runId: BATCH_RUN,
        user: 'Batch the row reads.',
        answer: 'Rows are read 500 at a time now. The CSV writer is unchanged.',
        startMinute: '03:40',
        endMinute: '09:10',
      }),
    },
    orchestratingWorkflowRuns: { [BLOCKED_MOUNT_RUN_ID]: false },
    orchestratorReadingHints: { [BLOCKED_MOUNT_RUN_ID]: [] },
    messages: { [BLOCKED_MOUNT_SESSION_ID]: [] },
    loadAgentTranscript: async () => undefined,
    loadSessionTelemetry: async () => undefined,
    sessionPlans: { [BLOCKED_MOUNT_SESSION_ID]: [] },
    sessionOpenQuestions: { [BLOCKED_MOUNT_SESSION_ID]: [] },
    sessionAnsweredQuestions: { [BLOCKED_MOUNT_SESSION_ID]: [] },
    sessionActiveMount: { [BLOCKED_MOUNT_SESSION_ID]: BLOCKED_MOUNT_B },
    sessionActiveProject: { [BLOCKED_MOUNT_SESSION_ID]: PROJECT_ID },
    mountBranchObservations: { [BLOCKED_MOUNT_SESSION_ID]: [] },
    drawer: null,
  });
  applyMountViews({
    set: useAppStore.setState,
    sessionId: BLOCKED_MOUNT_SESSION_ID,
    views: MOUNTS,
  });
  return SESSION;
};
