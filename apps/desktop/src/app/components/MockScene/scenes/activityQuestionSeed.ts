import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  Project,
  ProjectId,
  Session,
  SessionEvent,
  SessionEventId,
  SessionId,
  SessionProjectMount,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sceneClock } from '../sceneClock';

const clock = sceneClock({ anchor: '2026-09-28T10:05:00.000Z' });

const WORKSPACE_ID = 'mock-oq-workspace-northwind' as WorkspaceId;
const SESSION_ID = 'mock-oq-session-ledger-rounding' as SessionId;
const LEDGER_ID = 'mock-oq-project-ledger-core' as ProjectId;
const WORKFLOW_ID = 'mock-oq-workflow-rounding' as WorkflowId;
const WORKFLOW_RUN_ID = 'mock-oq-workflow-run-rounding' as WorkflowRunId;
const STEP_ID = 'mock-oq-step-implement' as StepId;
const AGENT_ID = 'mock-oq-agent-implement' as AgentId;
const QUESTION_ID = 'mock-oq-question-rounding-mode' as OpenQuestionId;

const at = ({ time }: { readonly time: string }): IsoDateTime =>
  clock.iso({ at: `2026-09-28T${time}.000Z` });

const NOW = at({ time: '10:05:00' });
const STARTED = at({ time: '09:40:00' });
const ASKED = at({ time: '09:52:00' });

const GOAL = 'Fix the rounding drift in the settlement export';

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
};

const WORKSPACE: Workspace = {
  id: WORKSPACE_ID,
  name: 'Northwind',
  slug: 'northwind',
  overrides: OVERRIDES,
  createdAt: STARTED,
  updatedAt: NOW,
};

const PROJECT: Project = {
  id: LEDGER_ID,
  workspaceId: WORKSPACE_ID,
  name: 'ledger-core',
  rootPath: '~/code/northwind/ledger-core',
  kind: 'repo',
  overrides: OVERRIDES,
  createdAt: STARTED,
  updatedAt: NOW,
};

const MOUNT: SessionProjectMount = {
  projectId: LEDGER_ID,
  mountName: 'ledger-core',
  worktreePath: '~/code/northwind/ledger-core-rounding',
  repoRoot: '~/code/northwind/ledger-core',
  branch: 'nw/fix-settlement-rounding',
  mountId: 'mock-oq-mount-ledger' as MountId,
  sessionId: SESSION_ID,
  lastWorktreePath: null,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

const STEPS: ReadonlyArray<Step> = [
  {
    id: STEP_ID,
    workflowId: WORKFLOW_ID,
    role: 'implementer',
    ordinal: 0,
    name: 'Round once at settlement',
    promptPrefix: 'Move rounding to the settlement boundary and keep line items exact.',
  },
];

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Fix the settlement rounding',
  description: 'One implementer step that moves rounding to the settlement boundary.',
  goal: GOAL,
  origin: 'orchestrated',
  steps: STEPS,
  createdAt: STARTED,
  updatedAt: NOW,
};

export const ACTIVITY_QUESTION_SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: GOAL,
  state: { kind: 'idle', lastActivityAt: ASKED },
  contextSlots: [{ key: 'goal', value: GOAL, enabled: true }],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [
    {
      id: WORKFLOW_RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'immediate',
      executionMode: 'static',
      goal: GOAL,
      createdAt: STARTED,
    },
  ],
  autoRun: true,
  titleUserEdited: true,
  activeProjectId: LEDGER_ID,
  createdAt: STARTED,
  updatedAt: NOW,
};

const AGENTS: ReadonlyArray<Agent> = [
  {
    id: AGENT_ID,
    sessionId: SESSION_ID,
    stepId: STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 0,
    name: 'Round once at settlement',
    kind: 'implementer',
    status: 'completed',
    outputSummary: 'Found two places that round per line item before the settlement total.',
    startedAt: STARTED,
    lastFinishedAt: ASKED,
    lastViewedAt: NOW,
    providerOverride: 'anthropic',
    modelOverride: 'claude-sonnet-5',
  },
];

const OPEN_QUESTIONS: ReadonlyArray<OpenQuestion> = [
  {
    id: QUESTION_ID,
    sessionId: SESSION_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    createdByAgentId: AGENT_ID,
    text: 'Round half up or half to even at the settlement total?',
    suggestedAnswers: ['Half to even, like the bank file', 'Half up, like the invoices'],
    recommendedAnswer: 'Half to even, like the bank file',
    selectMode: 'one',
    isBlocking: true,
    userAnswer: null,
    status: 'open',
    createdAt: ASKED,
  },
];

const SESSION_EVENTS = [
  {
    id: 'mock-oq-event-branch' as SessionEventId,
    sessionId: SESSION_ID,
    kind: 'branch_created',
    payload: { branch: MOUNT.branch, projectName: MOUNT.mountName },
    createdAt: at({ time: '09:38:00' }),
  },
] as unknown as ReadonlyArray<SessionEvent>;

export const seedActivityQuestionScene = () => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [PROJECT],
    sessions: [ACTIVITY_QUESTION_SESSION],
    currentSessionId: SESSION_ID,
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    sessionActiveProject: { [SESSION_ID]: LEDGER_ID },
    sessionActiveMount: { [SESSION_ID]: MOUNT.mountId },
    sessionWorktrees: { [SESSION_ID]: [MOUNT.worktreePath] },
    sessionWorktreeRecords: {
      [SESSION_ID]: [
        {
          id: 'mock-oq-worktree-0',
          sessionId: SESSION_ID,
          worktreePath: MOUNT.worktreePath,
          branch: MOUNT.branch,
          parallelIndex: 0,
          projectId: LEDGER_ID,
          mountName: MOUNT.mountName,
          repoSlug: 'northwind/ledger-core',
          createdAt: clock.ms({ at: '2026-09-28T09:38:00.000Z' }),
        },
      ],
    },
    sessionSlots: { [SESSION_ID]: ACTIVITY_QUESTION_SESSION.contextSlots },
    sessionSlotsLoad: { [SESSION_ID]: 'loaded' },
    sessionDecisions: { [SESSION_ID]: [] },
    sessionLoading: {
      [SESSION_ID]: {
        agents: false,
        transcript: false,
        telemetry: false,
        slots: false,
        plans: false,
        summary: false,
      },
    },
    sessionPhaseRuns: { [SESSION_ID]: AGENTS },
    sessionOpenQuestions: { [SESSION_ID]: OPEN_QUESTIONS },
    sessionAnsweredQuestions: { [SESSION_ID]: [] },
    sessionDismissedQuestions: { [SESSION_ID]: [] },
    sessionEvents: { [SESSION_ID]: SESSION_EVENTS },
    sessionArtifacts: { [SESSION_ID]: [] },
    sessionPlans: { [SESSION_ID]: [] },
    sessionWorkflows: { [SESSION_ID]: [WORKFLOW] },
    phaseTemplates: { [WORKSPACE_ID]: [WORKFLOW] },
    sessionTurnSpans: { [SESSION_ID]: [] },
    sessionExternalTasks: { [SESSION_ID]: [] },
    selectedAgentId: {},
    activeLens: { [SESSION_ID]: null },
    workspaceIntegrations: { [WORKSPACE_ID]: [] },
    sessionAttachments: { [SESSION_ID]: [] },
    loadSessionArtifacts: async () => undefined,
    loadSessionEvents: async () => undefined,
    loadSessionAnsweredQuestions: async () => undefined,
    loadSessionDismissedQuestions: async () => undefined,
    navigate: () => undefined,
    loadAgentTranscript: async () => undefined,
  });
};
