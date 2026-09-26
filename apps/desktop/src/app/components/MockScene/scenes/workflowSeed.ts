import type {
  Agent,
  AgentId,
  ContextSlot,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  Project,
  ProjectId,
  ProviderRunId,
  PullRequestState,
  Session,
  SessionEvent,
  SessionEventId,
  SessionExternalTask,
  SessionId,
  SessionProjectMount,
  StepId,
  TelemetryRecordId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sceneClock } from '../sceneClock';

const clock = sceneClock({ anchor: '2026-08-25T18:00:00.000Z' });

export const WORKSPACE_ID = 'mock-workflow-workspace-northwind' as WorkspaceId;
const SESSION_ID = 'mock-workflow-session-orders' as SessionId;
const API_ID = 'mock-workflow-project-api' as ProjectId;
const STOREFRONT_WEB_ID = 'mock-workflow-project-storefront-web' as ProjectId;
const WORKFLOW_ID = 'mock-workflow-orders' as WorkflowId;
const WORKFLOW_RUN_ID = 'mock-workflow-run-orders' as WorkflowRunId;
const SCOUT_STEP_ID = 'mock-workflow-step-scout' as StepId;
const CONTRACT_STEP_ID = 'mock-workflow-step-contract' as StepId;
const API_STEP_ID = 'mock-workflow-step-api' as StepId;
const LEGACY_CALLER_STEP_ID = 'mock-workflow-step-legacy-caller' as StepId;
const API_TEST_STEP_ID = 'mock-workflow-step-api-test' as StepId;
const CLIENT_STEP_ID = 'mock-workflow-step-client' as StepId;
const STOREFRONT_WEB_STEP_ID = 'mock-workflow-step-storefront-web' as StepId;
const SCOUT_AGENT_ID = 'mock-workflow-agent-scout' as AgentId;
const CONTRACT_PLAN_AGENT_ID = 'mock-workflow-agent-contract-plan' as AgentId;
const API_AGENT_ID = 'mock-workflow-agent-api' as AgentId;
const API_TEST_AGENT_ID = 'mock-workflow-agent-api-test' as AgentId;
const CLIENT_AGENT_ID = 'mock-workflow-agent-client' as AgentId;
const STOREFRONT_WEB_AGENT_ID = 'mock-workflow-agent-storefront-web' as AgentId;
const CONTRACT_AGENT_ID = 'mock-workflow-agent-contract-check' as AgentId;
const REBASE_AGENT_ID = 'mock-workflow-agent-rebase' as AgentId;
const CONFLICT_AGENT_ID = 'mock-workflow-agent-conflict-explain' as AgentId;
const STOREFRONT_WEB_PROVIDER_RUN_ID = 'mock-provider-run-storefront-web' as ProviderRunId;
const SUMMARIZER_PROVIDER_RUN_ID = 'mock-provider-run-summarizer' as ProviderRunId;
export const NOW = clock.iso({ at: '2026-08-25T18:00:00.000Z' });
const EARLIER = clock.iso({ at: '2026-08-25T17:04:00.000Z' });

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
};

const WORKSPACE: Workspace = {
  id: WORKSPACE_ID,
  name: 'Northwind',
  slug: 'northwind',
  overrides: OVERRIDES,
  createdAt: clock.iso({ at: '2026-08-25T15:10:00.000Z' }),
  updatedAt: NOW,
};

const PROJECTS: ReadonlyArray<Project> = [
  {
    id: API_ID,
    workspaceId: WORKSPACE_ID,
    name: 'api',
    rootPath: '/mock/northwind/workflow/api-source',
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: clock.iso({ at: '2026-08-25T15:12:00.000Z' }),
    updatedAt: NOW,
  },
  {
    id: STOREFRONT_WEB_ID,
    workspaceId: WORKSPACE_ID,
    name: 'storefront-web',
    rootPath: '/mock/northwind/workflow/storefront-web-source',
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: clock.iso({ at: '2026-08-25T15:13:00.000Z' }),
    updatedAt: NOW,
  },
];

const API_MOUNT: SessionProjectMount = {
  projectId: API_ID,
  mountName: 'api',
  worktreePath: '/mock/northwind/workflow/api',
  repoRoot: '/mock/northwind/workflow/api-source',
  branch: 'feat/create-orders-endpoint',
  mountId: 'mount-fixture-2' as MountId,
  sessionId: SESSION_ID,
  lastWorktreePath: null,
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

const STOREFRONT_WEB_MOUNT: SessionProjectMount = {
  projectId: STOREFRONT_WEB_ID,
  mountName: 'storefront-web',
  worktreePath: '/mock/northwind/workflow/storefront-web',
  repoRoot: '/mock/northwind/workflow/storefront-web-source',
  branch: 'feat/checkout-orders-api',
  mountId: 'mount-fixture-1' as MountId,
  sessionId: SESSION_ID,
  lastWorktreePath: null,
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

const MOUNTS = [API_MOUNT, STOREFRONT_WEB_MOUNT];

const CONTEXT_SLOTS: ReadonlyArray<ContextSlot> = [
  { key: 'goal', value: 'Add POST /orders and wire it into the checkout flow', enabled: true },
  {
    key: 'api_contract',
    value:
      'POST /orders accepts customerId and lineItems, then returns 201 with the created order id and status.',
    enabled: true,
  },
  {
    key: 'checkout_caller',
    value: 'storefront-web/src/features/checkout/CheckoutForm.tsx submits the finalized cart.',
    enabled: true,
  },
  {
    key: 'constraints',
    value: 'Keep the existing checkout error toast behavior when order creation is rejected.',
    enabled: true,
  },
];

const LINEAR_TASK: SessionExternalTask = {
  sessionId: SESSION_ID,
  projectId: STOREFRONT_WEB_ID,
  branch: STOREFRONT_WEB_MOUNT.branch,
  provider: 'linear',
  externalId: 'linear-nw-214',
  identifier: 'NW-214',
  url: 'https://linear.app/northwind/issue/NW-214/connect-checkout-to-order-creation',
  title: 'Connect checkout to order creation',
  createdAt: clock.iso({ at: '2026-08-25T17:06:20.000Z' }),
};

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Build and connect the orders endpoint',
  description: 'Trace the contract, implement the endpoint, and connect checkout.',
  goal: 'Add POST /orders and wire it into checkout',
  origin: 'orchestrated',
  steps: [
    {
      id: SCOUT_STEP_ID,
      workflowId: WORKFLOW_ID,
      role: 'scout',
      ordinal: 0,
      name: 'Scout the order flow',
      promptPrefix: 'Trace the existing order contract and checkout flow.',
    },
    {
      id: CONTRACT_STEP_ID,
      workflowId: WORKFLOW_ID,
      role: 'planner',
      ordinal: 1,
      name: 'Define the order contract',
      promptPrefix: 'Turn the discovered order flow into the request and response contract.',
    },
    {
      id: API_STEP_ID,
      workflowId: WORKFLOW_ID,
      role: 'implementer',
      ordinal: 2,
      name: 'Implement POST /orders in api',
      promptPrefix: 'Implement the orders endpoint in the api project.',
    },
    {
      id: LEGACY_CALLER_STEP_ID,
      workflowId: WORKFLOW_ID,
      role: 'scout',
      ordinal: 3,
      name: 'Check legacy order-shape callers',
      promptPrefix: 'Confirm whether checkout is the only caller using the legacy order shape.',
    },
    {
      id: API_TEST_STEP_ID,
      workflowId: WORKFLOW_ID,
      role: 'tester',
      ordinal: 4,
      name: 'Test order validation in api',
      promptPrefix: 'Add coverage for accepted and rejected order creation requests.',
    },
    {
      id: CLIENT_STEP_ID,
      workflowId: WORKFLOW_ID,
      role: 'implementer',
      ordinal: 5,
      name: 'Update the typed orders client',
      promptPrefix:
        'Expose the new order creation contract through the storefront-web typed client.',
    },
    {
      id: STOREFRONT_WEB_STEP_ID,
      workflowId: WORKFLOW_ID,
      role: 'implementer',
      ordinal: 6,
      name: 'Wire checkout errors in storefront-web',
      promptPrefix:
        'Connect checkout to the new endpoint and preserve rejected-order error states.',
    },
  ],
  createdAt: clock.iso({ at: '2026-08-25T17:07:00.000Z' }),
  updatedAt: NOW,
};

export const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Add POST /orders and wire it into the checkout flow',
  state: {
    kind: 'running',
    runId: STOREFRONT_WEB_PROVIDER_RUN_ID,
    startedAt: clock.iso({ at: '2026-08-25T17:57:00.000Z' }),
  },
  contextSlots: CONTEXT_SLOTS,
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [
    {
      id: WORKFLOW_RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      currentStep: 6,
      autoRun: true,
      triggerMode: 'immediate',
      executionMode: 'static',
      goal: 'Add POST /orders and wire it into the checkout flow',
      createdAt: clock.iso({ at: '2026-08-25T17:07:00.000Z' }),
    },
  ],
  autoRun: true,
  titleUserEdited: true,
  activeProjectId: STOREFRONT_WEB_ID,
  createdAt: EARLIER,
  updatedAt: NOW,
};

const AGENTS: ReadonlyArray<Agent> = [
  {
    id: SCOUT_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: SCOUT_STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 0,
    name: 'Scout the order flow',
    kind: 'scout',
    status: 'completed',
    outputSummary: 'Mapped the checkout request, order contract, and validation path.',
    startedAt: clock.iso({ at: '2026-08-25T17:08:00.000Z' }),
    completedAt: clock.iso({ at: '2026-08-25T17:12:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-08-25T17:12:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-08-25T17:12:00.000Z' }),
  },
  {
    id: CONTRACT_PLAN_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: CONTRACT_STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 1,
    name: 'Define the order contract',
    kind: 'planner',
    status: 'completed',
    outputSummary: 'Agreed the customerId and lineItems request with the 201 order response.',
    startedAt: clock.iso({ at: '2026-08-25T17:13:00.000Z' }),
    completedAt: clock.iso({ at: '2026-08-25T17:16:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-08-25T17:16:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-08-25T17:16:00.000Z' }),
  },
  {
    id: API_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: API_STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 2,
    name: 'Implement POST /orders in api',
    kind: 'implementer',
    status: 'completed',
    outputSummary: 'Added order validation, persistence, and the 201 response in api.',
    startedAt: clock.iso({ at: '2026-08-25T17:18:00.000Z' }),
    completedAt: clock.iso({ at: '2026-08-25T17:39:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-08-25T17:39:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-08-25T17:39:00.000Z' }),
  },
  {
    id: CONTRACT_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: LEGACY_CALLER_STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 3,
    name: 'Check legacy order-shape callers',
    kind: 'scout',
    status: 'completed',
    outputSummary: 'Confirmed checkout is the only caller that still sends the legacy order shape.',
    startedAt: clock.iso({ at: '2026-08-25T17:40:00.000Z' }),
    completedAt: clock.iso({ at: '2026-08-25T17:43:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-08-25T17:43:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-08-25T17:43:00.000Z' }),
  },
  {
    id: API_TEST_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: API_TEST_STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 4,
    name: 'Test order validation in api',
    kind: 'tester',
    status: 'completed',
    outputSummary: 'Covered successful creation, invalid line items, and missing customers.',
    startedAt: clock.iso({ at: '2026-08-25T17:45:00.000Z' }),
    completedAt: clock.iso({ at: '2026-08-25T17:50:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-08-25T17:50:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-08-25T17:50:00.000Z' }),
  },
  {
    id: CLIENT_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: CLIENT_STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 5,
    name: 'Update the typed orders client',
    kind: 'implementer',
    status: 'completed',
    outputSummary: 'Added typed create-order request, response, and rejected-request handling.',
    startedAt: clock.iso({ at: '2026-08-25T17:52:00.000Z' }),
    completedAt: clock.iso({ at: '2026-08-25T17:56:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-08-25T17:56:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-08-25T17:56:00.000Z' }),
  },
  {
    id: STOREFRONT_WEB_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: STOREFRONT_WEB_STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 6,
    name: 'Wire checkout errors in storefront-web',
    kind: 'implementer',
    status: 'running',
    runId: STOREFRONT_WEB_PROVIDER_RUN_ID,
    outputSummary: 'Wiring checkout submission while preserving the rejected-order toast.',
    startedAt: clock.iso({ at: '2026-08-25T17:57:00.000Z' }),
  },
  {
    id: REBASE_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 2.5,
    name: 'Rebase feat/create-orders-endpoint on main',
    kind: 'implementer',
    status: 'completed',
    outputSummary: 'Rebased the API branch cleanly on main and reran the order tests.',
    startedAt: clock.iso({ at: '2026-08-25T17:24:00.000Z' }),
    completedAt: clock.iso({ at: '2026-08-25T17:29:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-08-25T17:29:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-08-25T17:29:00.000Z' }),
  },
  {
    id: CONFLICT_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 3.5,
    name: 'Explain the 409 the checkout returns today',
    kind: 'scout',
    status: 'completed',
    outputSummary: 'The 409 means the cart was already submitted; checkout expects the error code.',
    startedAt: clock.iso({ at: '2026-08-25T17:42:00.000Z' }),
    completedAt: clock.iso({ at: '2026-08-25T17:44:00.000Z' }),
    lastFinishedAt: clock.iso({ at: '2026-08-25T17:44:00.000Z' }),
    lastViewedAt: NOW,
    doneAt: clock.iso({ at: '2026-08-25T17:44:00.000Z' }),
  },
];

const OPEN_QUESTIONS: ReadonlyArray<OpenQuestion> = [
  {
    id: 'mock-workflow-question-error-format' as OpenQuestionId,
    sessionId: SESSION_ID,
    workflowId: WORKFLOW_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    createdByStepOrdinal: 2,
    ownedByStepOrdinal: 2,
    createdByAgentId: API_AGENT_ID,
    text: 'Which error shape does checkout expect for rejected orders?',
    suggestedAnswers: ['Keep the current code and message shape', 'Adopt problem details'],
    recommendedAnswer: 'Keep the current code and message shape',
    isBlocking: false,
    userAnswer: 'Keep the current code and message shape so the existing toast still works.',
    status: 'answered',
    createdAt: clock.iso({ at: '2026-08-25T17:31:00.000Z' }),
    answeredAt: clock.iso({ at: '2026-08-25T17:34:00.000Z' }),
  },
];

const SESSION_EVENTS: ReadonlyArray<SessionEvent> = [
  {
    id: 'mock-workflow-event-started' as SessionEventId,
    sessionId: SESSION_ID,
    kind: 'workflow_started',
    payload: { workflowName: WORKFLOW.name, runId: WORKFLOW_RUN_ID },
    createdAt: clock.iso({ at: '2026-08-25T17:07:00.000Z' }),
  },
  {
    id: 'mock-workflow-event-decisions' as SessionEventId,
    sessionId: SESSION_ID,
    kind: 'decisions_changed',
    payload: { added: 3, removed: 0 },
    createdAt: clock.iso({ at: '2026-08-25T17:17:00.000Z' }),
  },
  {
    id: 'mock-workflow-event-api-pr' as SessionEventId,
    sessionId: SESSION_ID,
    kind: 'pr_created',
    payload: { number: 147, title: 'Add POST /orders' },
    createdAt: clock.iso({ at: '2026-08-25T17:55:00.000Z' }),
  },
];

const PR = ({
  number,
  title,
  headBranch,
}: {
  readonly number: number;
  readonly title: string;
  readonly headBranch: string;
}): PullRequestState => ({
  number,
  title,
  url: `https://example.invalid/northwind/pull/${number}`,
  state: 'open',
  mergeable: true,
  checks: 'pending',
  baseBranch: 'main',
  headBranch,
  isDraft: true,
  reviewDecision: 'review_required',
  body: '',
  updatedAt: NOW,
});

const EMPTY_GITHUB = {
  linkedIssues: [],
  fetchedAt: NOW,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
};

export const seedWorkflowScene = () => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE_ID,
    projects: PROJECTS,
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    sessionProjectMounts: { [SESSION_ID]: MOUNTS },
    sessionActiveProject: { [SESSION_ID]: STOREFRONT_WEB_ID },
    sessionWorktrees: { [SESSION_ID]: MOUNTS.map((mount) => mount.worktreePath) },
    sessionWorktreeRecords: {
      [SESSION_ID]: MOUNTS.map((mount, index) => ({
        id: `mock-workflow-worktree-${index}`,
        sessionId: SESSION_ID,
        worktreePath: mount.worktreePath,
        branch: mount.branch,
        parallelIndex: index,
        projectId: mount.projectId,
        mountName: mount.mountName,
        repoSlug: `northwind/${mount.mountName}`,
        createdAt: clock.ms({
          at: index === 0 ? '2026-08-25T17:05:15.000Z' : '2026-08-25T17:05:55.000Z',
        }),
      })),
    },
    sessionSlots: { [SESSION_ID]: CONTEXT_SLOTS },
    sessionSlotsLoad: { [SESSION_ID]: 'loaded' },
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
    summarizerStatus: {
      [SESSION_ID]: {
        status: 'idle',
        lastUpdate: NOW,
        error: null,
        lastUsage: null,
        lastAttempt: null,
      },
    },
    sessionPhaseRuns: { [SESSION_ID]: AGENTS },
    sessionOpenQuestions: { [SESSION_ID]: OPEN_QUESTIONS },
    sessionEvents: { [SESSION_ID]: SESSION_EVENTS },
    sessionPlans: { [SESSION_ID]: [] },
    sessionWorkflows: { [SESSION_ID]: [WORKFLOW] },
    phaseTemplates: { [WORKSPACE_ID]: [WORKFLOW] },
    sessionTelemetry: {
      [SESSION_ID]: [
        {
          id: 'mock-telemetry-summarizer-workflow' as TelemetryRecordId,
          runId: SUMMARIZER_PROVIDER_RUN_ID,
          sessionId: SESSION_ID,
          kind: 'summarizer',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          recordedAt: clock.iso({ at: '2026-08-25T17:21:00.000Z' }),
          inputTokens: 1_120,
          outputTokens: 280,
          estimatedCostUsd: 0.008,
        },
        {
          id: 'mock-telemetry-summarizer-middle' as TelemetryRecordId,
          runId: 'mock-provider-run-summarizer-middle' as ProviderRunId,
          sessionId: SESSION_ID,
          kind: 'summarizer',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          recordedAt: clock.iso({ at: '2026-08-25T17:41:00.000Z' }),
          inputTokens: 1_980,
          outputTokens: 420,
          estimatedCostUsd: 0.012,
        },
        {
          id: 'mock-telemetry-summarizer-latest' as TelemetryRecordId,
          runId: SUMMARIZER_PROVIDER_RUN_ID,
          sessionId: SESSION_ID,
          kind: 'summarizer',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          recordedAt: clock.iso({ at: '2026-08-25T17:56:30.000Z' }),
          inputTokens: 2_460,
          outputTokens: 510,
          estimatedCostUsd: 0.015,
        },
      ],
    },
    sessionExternalTasks: { [SESSION_ID]: [LINEAR_TASK] },
    sessionGithub: {
      [SESSION_ID]: {
        ...EMPTY_GITHUB,
        linkedIssues: [
          {
            number: 482,
            title: 'Checkout fails silently when the order payload is rejected',
            url: 'https://github.com/northwind/storefront-web/issues/482',
            closes: true,
          },
          {
            number: 495,
            title: 'Expose an order creation endpoint',
            url: 'https://github.com/northwind/api/issues/495',
            closes: true,
          },
        ],
        pr: PR({
          number: 319,
          title: 'Connect checkout to the orders endpoint',
          headBranch: STOREFRONT_WEB_MOUNT.branch,
        }),
      },
    },
    sessionProjectPrs: {
      [SESSION_ID]: {
        [API_ID]: [
          PR({
            number: 147,
            title: 'Add POST /orders',
            headBranch: API_MOUNT.branch,
          }),
        ],
        [STOREFRONT_WEB_ID]: [
          PR({
            number: 319,
            title: 'Connect checkout to the orders endpoint',
            headBranch: STOREFRONT_WEB_MOUNT.branch,
          }),
        ],
      },
    },
    agentKindOverride: {
      [SCOUT_AGENT_ID]: 'scout',
      [CONTRACT_PLAN_AGENT_ID]: 'planner',
      [API_AGENT_ID]: 'implementer',
      [API_TEST_AGENT_ID]: 'tester',
      [CLIENT_AGENT_ID]: 'implementer',
      [STOREFRONT_WEB_AGENT_ID]: 'implementer',
      [CONTRACT_AGENT_ID]: 'scout',
      [REBASE_AGENT_ID]: 'implementer',
      [CONFLICT_AGENT_ID]: 'scout',
    },
    setFocusedGithubIssueNumber: () => undefined,
    openExternalTaskLens: () => undefined,
    selectedAgentId: { [SESSION_ID]: STOREFRONT_WEB_AGENT_ID },
    activeLens: { [SESSION_ID]: null },
    workspaceIntegrations: { [WORKSPACE_ID]: [] },
    sessionAttachments: { [SESSION_ID]: [] },
    slotHistory: { [SESSION_ID]: {} },
    slotHistoryCounts: { [SESSION_ID]: {} },
  });
};
