import type {
  Agent,
  AgentId,
  ArtifactId,
  ContextSlot,
  IsoDateTime,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  PlanId,
  PlanWithCount,
  Project,
  ProjectId,
  ProviderRunId,
  PullRequestState,
  ReportArtifact,
  Session,
  SessionArtifact,
  SessionEvent,
  SessionEventId,
  SessionId,
  SessionProjectMount,
  Step,
  StepId,
  TelemetryRecordId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WireframeArtifact,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';

const WORKSPACE_ID = 'mock-run-workspace-cascadia' as WorkspaceId;
export const SESSION_ID = 'mock-run-session-webhooks' as SessionId;
const PAYMENTS_ID = 'mock-run-project-payments-api' as ProjectId;
const CONSOLE_ID = 'mock-run-project-web-console' as ProjectId;

const WORKFLOW_ID = 'mock-run-workflow-webhook-idempotency' as WorkflowId;
const WORKFLOW_RUN_ID = 'mock-run-workflow-run-webhook-idempotency' as WorkflowRunId;
const CONSOLE_WORKFLOW_ID = 'mock-run-workflow-console-retry' as WorkflowId;
const CONSOLE_RUN_ID = 'mock-run-workflow-run-console-retry' as WorkflowRunId;

const SCOUT_STEP_ID = 'mock-run-step-scout' as StepId;
const CONTRACT_STEP_ID = 'mock-run-step-contract' as StepId;
const KEY_COLUMN_STEP_ID = 'mock-run-step-key-column' as StepId;
const DEDUPE_STEP_ID = 'mock-run-step-dedupe' as StepId;
const TEST_STEP_ID = 'mock-run-step-test' as StepId;
const BACKFILL_STEP_ID = 'mock-run-step-backfill' as StepId;
const CONSOLE_STORE_STEP_ID = 'mock-run-step-console-store' as StepId;
const CONSOLE_BANNER_STEP_ID = 'mock-run-step-console-banner' as StepId;
const CONSOLE_TESTS_STEP_ID = 'mock-run-step-console-tests' as StepId;

const SCOUT_AGENT_ID = 'mock-run-agent-scout' as AgentId;
const SCOUT_ROUTE_AGENT_ID = 'mock-run-agent-scout-route' as AgentId;
const SCOUT_EVENTS_AGENT_ID = 'mock-run-agent-scout-events' as AgentId;
const SCOUT_RETRIES_AGENT_ID = 'mock-run-agent-scout-retries' as AgentId;
const PLANNER_AGENT_ID = 'mock-run-agent-planner' as AgentId;
const KEY_COLUMN_AGENT_ID = 'mock-run-agent-key-column' as AgentId;
const DEDUPE_AGENT_ID = 'mock-run-agent-dedupe' as AgentId;
const TESTER_AGENT_ID = 'mock-run-agent-tester' as AgentId;
const STRIPE_SEMANTICS_AGENT_ID = 'mock-run-agent-stripe-semantics' as AgentId;
const BACKFILL_AGENT_ID = 'mock-run-agent-backfill' as AgentId;
const WIREFRAME_AGENT_ID = 'mock-run-agent-wireframe' as AgentId;
const CONSOLE_STORE_AGENT_ID = 'mock-run-agent-console-store' as AgentId;
const CONSOLE_BANNER_AGENT_ID = 'mock-run-agent-console-banner' as AgentId;
const CONSOLE_TESTS_AGENT_ID = 'mock-run-agent-console-tests' as AgentId;
const REPORT_AGENT_ID = 'mock-run-agent-report' as AgentId;

const CONSOLE_PROVIDER_RUN_ID = 'mock-run-provider-run-console-store' as ProviderRunId;

const PLAN_ID = 'mock-run-plan-idempotency-key' as PlanId;
const PLAN_ARTIFACT_ID = 'mock-run-plan-idempotency-key' as ArtifactId;
const REPORT_ARTIFACT_ID = 'mock-run-report-session-summary' as ArtifactId;
const WIREFRAME_ARTIFACT_ID = 'mock-run-wireframe-retry-state' as ArtifactId;

const QUESTION_ORDER_ID = 'mock-run-question-backfill-order' as OpenQuestionId;
const QUESTION_BANNER_ID = 'mock-run-question-banner-threshold' as OpenQuestionId;

const DAY_ONE = '2026-09-17';
const DAY_TWO = '2026-09-18';
export const NOW = `${DAY_TWO}T10:05:00.000Z` as IsoDateTime;
const EARLIER = `${DAY_ONE}T09:12:00.000Z` as IsoDateTime;

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
};

const WORKSPACE: Workspace = {
  id: WORKSPACE_ID,
  name: 'Cascadia',
  slug: 'cascadia',
  sessionsRoot: '/mock/cascadia/sessions',
  overrides: OVERRIDES,
  createdAt: EARLIER,
  updatedAt: NOW,
};

const PROJECTS: ReadonlyArray<Project> = [
  {
    id: PAYMENTS_ID,
    workspaceId: WORKSPACE_ID,
    name: 'payments-api',
    rootPath: '/mock/cascadia/payments-api',
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: EARLIER,
    updatedAt: NOW,
  },
  {
    id: CONSOLE_ID,
    workspaceId: WORKSPACE_ID,
    name: 'web-console',
    rootPath: '/mock/cascadia/web-console',
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: EARLIER,
    updatedAt: NOW,
  },
];

const PAYMENTS_MOUNT: SessionProjectMount = {
  projectId: PAYMENTS_ID,
  mountName: 'payments-api',
  worktreePath: '/mock/cascadia/payments-api-idempotency',
  repoRoot: '/mock/cascadia/payments-api',
  branch: 'nw/fix-webhook-idempotency',
  mountId: 'mock-run-mount-payments' as MountId,
  sessionId: SESSION_ID,
  lastWorktreePath: null,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

const CONSOLE_MOUNT: SessionProjectMount = {
  projectId: CONSOLE_ID,
  mountName: 'web-console',
  worktreePath: '/mock/cascadia/web-console-retry-state',
  repoRoot: '/mock/cascadia/web-console',
  branch: 'nw/surface-retry-state',
  mountId: 'mock-run-mount-console' as MountId,
  sessionId: SESSION_ID,
  lastWorktreePath: null,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
};

const MOUNTS = [PAYMENTS_MOUNT, CONSOLE_MOUNT];

const GOAL =
  'Stop payments-api from double-crediting invoices when Stripe redelivers a webhook, then surface the retry state in web-console so support can see a stuck delivery';

const CONTEXT_SLOTS: ReadonlyArray<ContextSlot> = [
  { key: 'goal', value: GOAL, enabled: true },
  {
    key: 'decisions',
    value: [
      "- Key the idempotency check on Stripe's event id, not a hash of the payload, because the payload changes between retries but the event id never does",
      '- Write the dedupe check inside the same transaction as the credit, because a crash between the check and the commit would still double credit',
      '- Backfill runs read only for its first pass, because three years of settled events is too much to trust to one migration',
      '- Keep the retry state store on payments-api, not web-console, so web-console stays a read only view instead of a second source of truth',
    ].join('\n'),
    enabled: true,
  },
  {
    key: 'last_output_summary',
    value: [
      '#### Problem',
      'Stripe redelivers a webhook whenever payments-api is slow to acknowledge it, and every redelivery was posting a second credit to the invoice.',
      '',
      '#### Learned',
      'The handler had no idempotency key, so two deliveries of the same event looked like two separate payments to everything downstream.',
      '',
      '#### State',
      'The dedupe check and the idempotency column are live in payments-api. The backfill for already settled events is written and stays read only. web-console still shows nothing for a stuck delivery.',
      '',
      '#### Next',
      'Wire the new retry state into web-console, then flip the backfill out of read only once a week of live traffic confirms the counts hold.',
    ].join('\n'),
    enabled: true,
  },
];

const at = ({ day, time }: { readonly day: string; readonly time: string }): IsoDateTime =>
  `${day}T${time}.000Z` as IsoDateTime;

const WORKFLOW_STEPS: ReadonlyArray<Step> = [
  {
    id: SCOUT_STEP_ID,
    workflowId: WORKFLOW_ID,
    role: 'scout',
    ordinal: 0,
    name: 'Trace the webhook delivery path',
    promptPrefix: 'Trace how payments-api receives and acknowledges a Stripe webhook.',
  },
  {
    id: CONTRACT_STEP_ID,
    workflowId: WORKFLOW_ID,
    role: 'planner',
    ordinal: 1,
    name: 'Design the idempotency key and backfill plan',
    promptPrefix: 'Turn the trace into an idempotency key design and a backfill plan.',
  },
  {
    id: KEY_COLUMN_STEP_ID,
    workflowId: WORKFLOW_ID,
    role: 'implementer',
    ordinal: 2,
    name: 'Add the idempotency key column in payments-api',
    promptPrefix: 'Add the idempotency key column and unique constraint.',
  },
  {
    id: DEDUPE_STEP_ID,
    workflowId: WORKFLOW_ID,
    role: 'implementer',
    ordinal: 3,
    name: 'Dedupe check in the webhook handler',
    promptPrefix: 'Reject a redelivered event before it reaches the credit path.',
  },
  {
    id: TEST_STEP_ID,
    workflowId: WORKFLOW_ID,
    role: 'tester',
    ordinal: 4,
    name: 'Cover duplicate webhook delivery',
    promptPrefix: 'Prove a redelivered event cannot double credit an invoice.',
  },
  {
    id: BACKFILL_STEP_ID,
    workflowId: WORKFLOW_ID,
    role: 'implementer',
    ordinal: 5,
    name: 'Backfill idempotency keys for settled events',
    promptPrefix: 'Backfill three years of settled events behind a read only flag.',
  },
];

const CONSOLE_STEPS: ReadonlyArray<Step> = [
  {
    id: CONSOLE_STORE_STEP_ID,
    workflowId: CONSOLE_WORKFLOW_ID,
    role: 'implementer',
    ordinal: 0,
    name: 'Read retry state from the typed endpoint',
    promptPrefix: 'Give web-console a store for deduped and stuck deliveries.',
  },
  {
    id: CONSOLE_BANNER_STEP_ID,
    workflowId: CONSOLE_WORKFLOW_ID,
    role: 'implementer',
    ordinal: 1,
    name: 'Add the stuck-delivery banner',
    promptPrefix: 'Warn support when a delivery has been retried more than twice.',
  },
  {
    id: CONSOLE_TESTS_STEP_ID,
    workflowId: CONSOLE_WORKFLOW_ID,
    role: 'tester',
    ordinal: 2,
    name: 'Cover the console retry states',
    promptPrefix: 'Pin the empty, stuck and recovered states of the banner.',
  },
];

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Harden the webhook against redelivery',
  description: 'Trace the webhook path, dedupe it, backfill settled events, then surface retries.',
  goal: GOAL,
  origin: 'orchestrated',
  steps: WORKFLOW_STEPS,
  createdAt: EARLIER,
  updatedAt: NOW,
};

const CONSOLE_WORKFLOW: Workflow = {
  id: CONSOLE_WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Surface retry state in web-console',
  description: 'Read the retry state, warn on a stuck delivery, then pin the states with tests.',
  goal: 'Let support see a stuck or deduped delivery without opening the database',
  origin: 'orchestrated',
  steps: CONSOLE_STEPS,
  createdAt: at({ day: DAY_ONE, time: '11:05:00' }),
  updatedAt: NOW,
};

export const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: GOAL,
  state: {
    kind: 'running',
    runId: CONSOLE_PROVIDER_RUN_ID,
    startedAt: `${DAY_TWO}T09:59:00.000Z` as IsoDateTime,
  },
  contextSlots: CONTEXT_SLOTS,
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [
    {
      id: WORKFLOW_RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      currentStep: 5,
      autoRun: true,
      triggerMode: 'immediate',
      executionMode: 'static',
      goal: GOAL,
      createdAt: EARLIER,
    },
    {
      id: CONSOLE_RUN_ID,
      workflowId: CONSOLE_WORKFLOW_ID,
      ordinal: 1,
      currentStep: 1,
      autoRun: true,
      triggerMode: 'immediate',
      executionMode: 'static',
      goal: 'Let support see a stuck or deduped delivery without opening the database',
      createdAt: at({ day: DAY_ONE, time: '11:05:00' }),
    },
  ],
  autoRun: true,
  titleUserEdited: true,
  activeProjectId: PAYMENTS_ID,
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
    name: 'Trace the webhook delivery path',
    kind: 'scout',
    status: 'completed',
    outputSummary:
      'The handler acknowledges before the credit commits, so a slow ack triggers a redelivery mid-write.',
    startedAt: at({ day: DAY_ONE, time: '09:14:00' }),
    completedAt: at({ day: DAY_ONE, time: '09:29:00' }),
    lastFinishedAt: at({ day: DAY_ONE, time: '09:29:00' }),
    lastViewedAt: NOW,
    doneAt: at({ day: DAY_ONE, time: '09:29:00' }),
    providerOverride: 'cursor',
    modelOverride: 'composer-2.5',
  },
  {
    id: SCOUT_ROUTE_AGENT_ID,
    sessionId: SESSION_ID,
    parentAgentId: SCOUT_AGENT_ID,
    ordinal: 0.1,
    name: 'webhook route and handler',
    kind: 'scout',
    status: 'completed',
    outputSummary:
      'payments-api/src/webhooks/stripeHandler.ts acks the request before the credit transaction opens.',
    startedAt: at({ day: DAY_ONE, time: '09:14:00' }),
    completedAt: at({ day: DAY_ONE, time: '09:21:00' }),
    lastFinishedAt: at({ day: DAY_ONE, time: '09:21:00' }),
    providerOverride: 'cursor',
    modelOverride: 'composer-2.5',
  },
  {
    id: SCOUT_EVENTS_AGENT_ID,
    sessionId: SESSION_ID,
    parentAgentId: SCOUT_AGENT_ID,
    ordinal: 0.2,
    name: 'event store schema',
    kind: 'scout',
    status: 'completed',
    outputSummary:
      'The events table keys on an internal uuid, not the Stripe event id, so nothing rejects a duplicate today.',
    startedAt: at({ day: DAY_ONE, time: '09:14:00' }),
    completedAt: at({ day: DAY_ONE, time: '09:24:00' }),
    lastFinishedAt: at({ day: DAY_ONE, time: '09:24:00' }),
    providerOverride: 'cursor',
    modelOverride: 'composer-2.5',
  },
  {
    id: SCOUT_RETRIES_AGENT_ID,
    sessionId: SESSION_ID,
    parentAgentId: SCOUT_AGENT_ID,
    ordinal: 0.3,
    name: 'Stripe retry semantics',
    kind: 'scout',
    status: 'completed',
    outputSummary:
      'Stripe redelivers on any non-2xx or timeout, with the same event id every time, for up to three days.',
    startedAt: at({ day: DAY_ONE, time: '09:15:00' }),
    completedAt: at({ day: DAY_ONE, time: '09:27:00' }),
    lastFinishedAt: at({ day: DAY_ONE, time: '09:27:00' }),
    providerOverride: 'cursor',
    modelOverride: 'composer-2.5',
  },
  {
    id: WIREFRAME_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 0.5,
    name: 'Draw the stuck-delivery banner',
    kind: 'wireframe',
    status: 'completed',
    outputSummary: 'Two screens: the delivery list with a stuck row, and the banner expanded.',
    startedAt: at({ day: DAY_ONE, time: '09:30:00' }),
    completedAt: at({ day: DAY_ONE, time: '09:38:00' }),
    lastFinishedAt: at({ day: DAY_ONE, time: '09:38:00' }),
    lastViewedAt: NOW,
    doneAt: at({ day: DAY_ONE, time: '09:38:00' }),
    providerOverride: 'anthropic',
    modelOverride: 'claude-sonnet-5',
  },
  {
    id: PLANNER_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: CONTRACT_STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 1,
    name: 'Design the idempotency key and backfill plan',
    kind: 'planner',
    status: 'completed',
    outputSummary:
      'Key the dedupe check on the Stripe event id, check it inside the credit transaction, backfill settled events read only.',
    startedAt: at({ day: DAY_ONE, time: '09:40:00' }),
    completedAt: at({ day: DAY_ONE, time: '09:47:00' }),
    lastFinishedAt: at({ day: DAY_ONE, time: '09:47:00' }),
    lastViewedAt: NOW,
    doneAt: at({ day: DAY_ONE, time: '09:47:00' }),
    providerOverride: 'anthropic',
    modelOverride: 'claude-opus-5',
  },
  {
    id: KEY_COLUMN_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: KEY_COLUMN_STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 2,
    name: 'Add the idempotency key column in payments-api',
    kind: 'implementer',
    status: 'completed',
    outputSummary:
      'Added a unique stripe_event_id column on webhook_events with a migration and a backfill-safe default.',
    startedAt: at({ day: DAY_ONE, time: '09:50:00' }),
    completedAt: at({ day: DAY_ONE, time: '10:22:00' }),
    lastFinishedAt: at({ day: DAY_ONE, time: '10:22:00' }),
    lastViewedAt: NOW,
    doneAt: at({ day: DAY_ONE, time: '10:22:00' }),
    providerOverride: 'codex',
    modelOverride: 'gpt-5.6-sol',
  },
  {
    id: DEDUPE_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: DEDUPE_STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 3,
    name: 'Dedupe check in the webhook handler',
    kind: 'implementer',
    status: 'completed',
    outputSummary:
      'The handler now rejects a redelivered event inside the same transaction as the credit, before it commits.',
    startedAt: at({ day: DAY_ONE, time: '10:24:00' }),
    completedAt: at({ day: DAY_ONE, time: '10:58:00' }),
    lastFinishedAt: at({ day: DAY_ONE, time: '10:58:00' }),
    lastViewedAt: NOW,
    doneAt: at({ day: DAY_ONE, time: '10:58:00' }),
    providerOverride: 'codex',
    modelOverride: 'gpt-5.6-sol',
  },
  {
    id: TESTER_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: TEST_STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 4,
    name: 'Cover duplicate webhook delivery',
    kind: 'tester',
    status: 'completed',
    outputSummary:
      'Added 11 cases, including a redelivery that arrives mid-transaction and one that arrives after a crash.',
    startedAt: at({ day: DAY_ONE, time: '11:00:00' }),
    completedAt: at({ day: DAY_ONE, time: '11:26:00' }),
    lastFinishedAt: at({ day: DAY_ONE, time: '11:26:00' }),
    lastViewedAt: NOW,
    doneAt: at({ day: DAY_ONE, time: '11:26:00' }),
    providerOverride: 'anthropic',
    modelOverride: 'claude-haiku-4-5',
  },
  {
    id: STRIPE_SEMANTICS_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 4.5,
    name: "Confirm Stripe's webhook retry-after header",
    kind: 'scout',
    status: 'completed',
    outputSummary:
      'Stripe does not send a retry-after header; the three day window is fixed and undocumented outside their changelog.',
    startedAt: at({ day: DAY_ONE, time: '11:28:00' }),
    completedAt: at({ day: DAY_ONE, time: '11:34:00' }),
    lastFinishedAt: at({ day: DAY_ONE, time: '11:34:00' }),
    lastViewedAt: NOW,
    doneAt: at({ day: DAY_ONE, time: '11:34:00' }),
    providerOverride: 'cursor',
    modelOverride: 'composer-2.5',
  },
  {
    id: BACKFILL_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: BACKFILL_STEP_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    ordinal: 5,
    name: 'Backfill idempotency keys for settled events',
    kind: 'implementer',
    status: 'completed',
    outputSummary:
      'Backfilled three years of settled events with the derived key, read only, no live writes yet.',
    startedAt: at({ day: DAY_ONE, time: '11:35:00' }),
    completedAt: at({ day: DAY_ONE, time: '12:40:00' }),
    lastFinishedAt: at({ day: DAY_ONE, time: '12:40:00' }),
    lastViewedAt: NOW,
    doneAt: at({ day: DAY_ONE, time: '12:40:00' }),
    providerOverride: 'anthropic',
    modelOverride: 'claude-sonnet-4-5',
  },
  {
    id: CONSOLE_STORE_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: CONSOLE_STORE_STEP_ID,
    workflowRunId: CONSOLE_RUN_ID,
    ordinal: 4.2,
    name: 'Read retry state from the typed endpoint',
    kind: 'implementer',
    status: 'completed',
    outputSummary: 'web-console now reads deduped and stuck deliveries from a typed endpoint.',
    startedAt: at({ day: DAY_ONE, time: '11:10:00' }),
    completedAt: at({ day: DAY_ONE, time: '11:52:00' }),
    lastFinishedAt: at({ day: DAY_ONE, time: '11:52:00' }),
    lastViewedAt: NOW,
    doneAt: at({ day: DAY_ONE, time: '11:52:00' }),
    providerOverride: 'anthropic',
    modelOverride: 'claude-sonnet-4-5',
  },
  {
    id: CONSOLE_BANNER_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: CONSOLE_BANNER_STEP_ID,
    workflowRunId: CONSOLE_RUN_ID,
    ordinal: 6,
    name: 'Add the stuck-delivery banner',
    kind: 'implementer',
    status: 'running',
    runId: CONSOLE_PROVIDER_RUN_ID,
    outputSummary:
      'Drafting the banner support sees when a delivery has been retried more than twice.',
    startedAt: at({ day: DAY_TWO, time: '09:40:00' }),
    providerOverride: 'cursor',
    modelOverride: 'kimi-k3',
  },
  {
    id: CONSOLE_TESTS_AGENT_ID,
    sessionId: SESSION_ID,
    stepId: CONSOLE_TESTS_STEP_ID,
    workflowRunId: CONSOLE_RUN_ID,
    ordinal: 6.5,
    name: 'Cover the console retry states',
    kind: 'tester',
    status: 'pending',
    providerOverride: 'anthropic',
    modelOverride: 'claude-haiku-4-5',
  },
  {
    id: REPORT_AGENT_ID,
    sessionId: SESSION_ID,
    ordinal: 7,
    name: 'Report the session outcome',
    kind: 'report',
    status: 'completed',
    outputSummary: 'Wrote the session summary from the run evidence collected so far.',
    startedAt: at({ day: DAY_TWO, time: '10:00:00' }),
    completedAt: at({ day: DAY_TWO, time: '10:04:00' }),
    lastFinishedAt: at({ day: DAY_TWO, time: '10:04:00' }),
    lastViewedAt: NOW,
    doneAt: at({ day: DAY_TWO, time: '10:04:00' }),
    providerOverride: 'anthropic',
    modelOverride: 'claude-sonnet-4-5',
  },
];

const PLAN_BODY = `## Approach

Key the dedupe check on the Stripe event id and check it inside the same transaction as the credit, then backfill settled events read only before trusting it live.

## Steps

1. Add a unique \`stripe_event_id\` column to \`webhook_events\`.
2. Move the dedupe check inside the credit transaction, not before it.
3. Backfill three years of settled events behind a read only flag.
4. Surface retry state in web-console once the backfill counts hold.

## Risks

- The backfill touches settled rows, so it stays read only until an operator compares totals.`;

const PLAN_ARTIFACT: SessionArtifact = {
  id: PLAN_ARTIFACT_ID,
  sessionId: SESSION_ID,
  agentId: PLANNER_AGENT_ID,
  workflowRunId: WORKFLOW_RUN_ID,
  kind: 'plan',
  schemaVersion: 1,
  title: 'Key the dedupe check on the Stripe event id',
  sourceFormat: 'markdown',
  sourceText: PLAN_BODY,
  metadata: {},
  status: 'consumed',
  revision: 1,
  sourceTurnId: 'mock-run-turn-plan',
  createdAt: at({ day: DAY_ONE, time: '09:47:00' }),
  updatedAt: at({ day: DAY_ONE, time: '09:47:00' }),
};

const WIREFRAME_DOCUMENT = {
  version: 1,
  initialScreenId: 'deliveries',
  theme: { name: 'generic', font: 'sans', radius: 'md' },
  screens: [
    {
      id: 'deliveries',
      title: 'Webhook deliveries',
      viewport: 'desktop',
      root: {
        id: 'deliveries-stack',
        type: 'stack',
        direction: 'vertical',
        gap: 'md',
        children: [
          { id: 'deliveries-title', type: 'text', variant: 'heading', text: 'Deliveries' },
          {
            id: 'deliveries-table',
            type: 'table',
            columns: ['Event', 'Attempts', 'State'],
            rows: [
              ['evt_1KpQ', '1', 'credited'],
              ['evt_1KpR', '4', 'stuck'],
              ['evt_1KpS', '2', 'deduped'],
            ],
          },
        ],
      },
    },
    {
      id: 'stuck',
      title: 'Stuck delivery',
      viewport: 'desktop',
      root: {
        id: 'stuck-stack',
        type: 'stack',
        direction: 'vertical',
        gap: 'md',
        children: [
          {
            id: 'stuck-banner',
            type: 'text',
            variant: 'body',
            text: 'evt_1KpR has been retried 4 times in the last hour.',
          },
          { id: 'stuck-replay', type: 'button', label: 'Replay once', variant: 'primary' },
        ],
      },
    },
  ],
  transitions: [{ fromNodeId: 'deliveries-table', toScreenId: 'stuck', label: 'open a stuck row' }],
};

const WIREFRAME_ARTIFACT: WireframeArtifact = {
  id: WIREFRAME_ARTIFACT_ID,
  sessionId: SESSION_ID,
  agentId: WIREFRAME_AGENT_ID,
  workflowRunId: null,
  kind: 'wireframe',
  schemaVersion: 1,
  title: 'Stuck delivery in web-console',
  sourceFormat: 'json',
  sourceText: JSON.stringify(WIREFRAME_DOCUMENT, null, 2),
  metadata: { fidelity: 'low', designProfile: {} },
  status: 'active',
  revision: 1,
  sourceTurnId: 'mock-run-turn-wireframe',
  createdAt: at({ day: DAY_ONE, time: '09:38:00' }),
  updatedAt: at({ day: DAY_ONE, time: '09:38:00' }),
};

const PLANS: ReadonlyArray<PlanWithCount> = [
  {
    id: PLAN_ID,
    sessionId: SESSION_ID,
    agentId: PLANNER_AGENT_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    title: 'Key the dedupe check on the Stripe event id',
    bodyMd: PLAN_BODY,
    status: 'consumed',
    createdAt: at({ day: DAY_ONE, time: '09:47:00' }),
    updatedAt: at({ day: DAY_ONE, time: '09:47:00' }),
    consumptionCount: 1,
  },
];

const REPORT_BODY = `# Webhook redelivery no longer double credits

Stripe redelivers a webhook whenever payments-api is slow to acknowledge it. Every redelivery
was posting a second credit to the invoice, because nothing checked whether the event had
already been applied.

## What changed

| Area | Before | After |
| --- | --- | --- |
| dedupe key | none | Stripe event id, unique |
| dedupe timing | none | inside the credit transaction |
| settled events | drift kept | backfilled, read only |
| web-console | no visibility | retry state store live, banner in progress |

## Evidence

- \`payments-api\` at \`f2a917c\`: 14 files changed, 224 additions, 58 deletions.
- 11 redelivery cases pass, including a crash between the check and the commit.

## Sources

- agent ${DEDUPE_AGENT_ID}
- agent ${TESTER_AGENT_ID}
- plan ${PLAN_ARTIFACT_ID}

## Open questions

1. Once the backfill leaves read only, does it replay in event-id order or settlement order?

## Next steps

- Finish the stuck-delivery banner and console coverage in web-console.
- Flip the backfill out of read only after a week of live traffic confirms the counts hold.`;

const REPORT_ARTIFACT: ReportArtifact = {
  id: REPORT_ARTIFACT_ID,
  sessionId: SESSION_ID,
  agentId: REPORT_AGENT_ID,
  workflowRunId: null,
  kind: 'report',
  schemaVersion: 1,
  title: 'Webhook redelivery no longer double credits',
  sourceFormat: 'markdown',
  sourceText: REPORT_BODY,
  metadata: { reportType: 'session-summary' },
  status: 'active',
  revision: 1,
  sourceTurnId: 'mock-run-turn-report',
  createdAt: at({ day: DAY_TWO, time: '10:04:00' }),
  updatedAt: at({ day: DAY_TWO, time: '10:04:00' }),
};

const ANSWERED_QUESTIONS: ReadonlyArray<OpenQuestion> = [
  {
    id: QUESTION_ORDER_ID,
    sessionId: SESSION_ID,
    workflowRunId: WORKFLOW_RUN_ID,
    createdByAgentId: BACKFILL_AGENT_ID,
    text: 'Does the backfill replay in event-id order or in settlement order?',
    suggestedAnswers: ['Settlement order, it matches the ledger', 'Event-id order, it is cheaper'],
    recommendedAnswer: 'Settlement order, it matches the ledger',
    selectMode: 'one',
    isBlocking: true,
    userAnswer: 'Settlement order, it matches the ledger',
    answerSource: 'user',
    status: 'answered',
    createdAt: at({ day: DAY_ONE, time: '12:05:00' }),
    answeredAt: at({ day: DAY_ONE, time: '12:12:00' }),
    answerDeliveredAt: at({ day: DAY_ONE, time: '12:12:00' }),
  },
];

const OPEN_QUESTIONS: ReadonlyArray<OpenQuestion> = [
  {
    id: QUESTION_BANNER_ID,
    sessionId: SESSION_ID,
    workflowRunId: CONSOLE_RUN_ID,
    createdByAgentId: CONSOLE_BANNER_AGENT_ID,
    text: 'How many retries should raise the banner?',
    suggestedAnswers: [
      'Three, it is the first retry support ever notices',
      'Two, so nothing sits stuck for an hour',
      'Whatever crosses the five minute mark, count aside',
    ],
    recommendedAnswer: 'Three, it is the first retry support ever notices',
    selectMode: 'one',
    isBlocking: true,
    userAnswer: null,
    status: 'open',
    createdAt: at({ day: DAY_TWO, time: '09:58:00' }),
  },
];

const SESSION_EVENTS = [
  {
    id: 'mock-run-event-branch' as SessionEventId,
    sessionId: SESSION_ID,
    kind: 'branch_created',
    payload: { branch: PAYMENTS_MOUNT.branch, projectName: PAYMENTS_MOUNT.mountName },
    createdAt: at({ day: DAY_ONE, time: '09:12:00' }),
  },
  {
    id: 'mock-run-event-decisions' as SessionEventId,
    sessionId: SESSION_ID,
    kind: 'decisions_changed',
    payload: { added: 4, removed: 0 },
    createdAt: at({ day: DAY_ONE, time: '09:48:00' }),
  },
  {
    id: 'mock-run-event-pr' as SessionEventId,
    sessionId: SESSION_ID,
    kind: 'pr_created',
    payload: {
      number: 612,
      title: 'Add an idempotency guard to the webhook handler',
      url: 'https://example.invalid/cascadia/payments-api/pull/612',
    },
    createdAt: at({ day: DAY_ONE, time: '11:30:00' }),
  },
  {
    id: 'mock-run-event-console-branch' as SessionEventId,
    sessionId: SESSION_ID,
    kind: 'branch_created',
    payload: { branch: CONSOLE_MOUNT.branch, projectName: CONSOLE_MOUNT.mountName },
    createdAt: at({ day: DAY_ONE, time: '11:06:00' }),
  },
  {
    id: 'mock-run-event-pr-merged' as SessionEventId,
    sessionId: SESSION_ID,
    kind: 'pr_merged',
    payload: {
      number: 612,
      title: 'Add an idempotency guard to the webhook handler',
      url: 'https://example.invalid/cascadia/payments-api/pull/612',
    },
    createdAt: at({ day: DAY_TWO, time: '09:25:00' }),
  },
  {
    id: 'mock-run-event-console-pr' as SessionEventId,
    sessionId: SESSION_ID,
    kind: 'pr_created',
    payload: {
      number: 48,
      title: 'Show retry state on the deliveries screen',
      url: 'https://example.invalid/cascadia/web-console/pull/48',
    },
    createdAt: at({ day: DAY_TWO, time: '09:45:00' }),
  },
] as unknown as ReadonlyArray<SessionEvent>;

const PR = ({
  number,
  title,
  headBranch,
  repo,
  state,
  checks,
  reviewDecision,
}: {
  readonly number: number;
  readonly title: string;
  readonly headBranch: string;
  readonly repo: string;
  readonly state: PullRequestState['state'];
  readonly checks: PullRequestState['checks'];
  readonly reviewDecision: PullRequestState['reviewDecision'];
}): PullRequestState => ({
  number,
  title,
  url: `https://example.invalid/cascadia/${repo}/pull/${number}`,
  state,
  mergeable: state === 'open',
  checks,
  baseBranch: 'main',
  headBranch,
  isDraft: false,
  reviewDecision,
  body: '',
  updatedAt: NOW,
});

const PAYMENTS_PR = PR({
  number: 612,
  title: 'Add an idempotency guard to the webhook handler',
  headBranch: PAYMENTS_MOUNT.branch,
  repo: 'payments-api',
  state: 'merged',
  checks: 'success',
  reviewDecision: 'approved',
});

const CONSOLE_PR = PR({
  number: 48,
  title: 'Show retry state on the deliveries screen',
  headBranch: CONSOLE_MOUNT.branch,
  repo: 'web-console',
  state: 'open',
  checks: 'pending',
  reviewDecision: 'review_required',
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

export const seedActivityRunScene = () => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE_ID,
    projects: PROJECTS,
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    sessionProjectMounts: { [SESSION_ID]: MOUNTS },
    sessionActiveProject: { [SESSION_ID]: PAYMENTS_ID },
    sessionWorktrees: { [SESSION_ID]: MOUNTS.map((mount) => mount.worktreePath) },
    sessionWorktreeRecords: {
      [SESSION_ID]: MOUNTS.map((mount, index) => ({
        id: `mock-run-worktree-${index}`,
        sessionId: SESSION_ID,
        worktreePath: mount.worktreePath,
        branch: mount.branch,
        parallelIndex: index,
        projectId: mount.projectId,
        mountName: mount.mountName,
        repoSlug: `cascadia/${mount.mountName}`,
        createdAt: Date.parse(index === 0 ? EARLIER : `${DAY_ONE}T09:13:00.000Z`),
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
    sessionAnsweredQuestions: { [SESSION_ID]: ANSWERED_QUESTIONS },
    sessionDismissedQuestions: { [SESSION_ID]: [] },
    sessionEvents: { [SESSION_ID]: SESSION_EVENTS },
    sessionArtifacts: { [SESSION_ID]: [WIREFRAME_ARTIFACT, PLAN_ARTIFACT, REPORT_ARTIFACT] },
    sessionPlans: { [SESSION_ID]: PLANS },
    planConsumptions: {},
    focusedPlanId: { [SESSION_ID]: null },
    focusedArtifactId: { [SESSION_ID]: null },
    sessionWorkflows: { [SESSION_ID]: [WORKFLOW, CONSOLE_WORKFLOW] },
    phaseTemplates: { [WORKSPACE_ID]: [WORKFLOW, CONSOLE_WORKFLOW] },
    agentTurnState: {
      [CONSOLE_BANNER_AGENT_ID]: {
        kind: 'running',
        runId: CONSOLE_PROVIDER_RUN_ID,
        startedAt: at({ day: DAY_TWO, time: '09:59:00' }),
      },
    },
    sessionTelemetry: {
      [SESSION_ID]: [
        {
          id: 'mock-run-telemetry-key-column' as TelemetryRecordId,
          runId: 'mock-run-provider-run-key-column' as ProviderRunId,
          sessionId: SESSION_ID,
          kind: 'turn',
          provider: 'codex',
          model: 'gpt-6-astra',
          recordedAt: at({ day: DAY_ONE, time: '10:22:00' }),
          inputTokens: 8_400,
          outputTokens: 1_950,
          estimatedCostUsd: 0.61,
        },
        {
          id: 'mock-run-telemetry-backfill' as TelemetryRecordId,
          runId: 'mock-run-provider-run-backfill' as ProviderRunId,
          sessionId: SESSION_ID,
          kind: 'turn',
          provider: 'anthropic',
          model: 'claude-opus-5',
          recordedAt: at({ day: DAY_ONE, time: '12:40:00' }),
          inputTokens: 21_300,
          outputTokens: 4_120,
          estimatedCostUsd: 1.94,
        },
        {
          id: 'mock-run-telemetry-console' as TelemetryRecordId,
          runId: CONSOLE_PROVIDER_RUN_ID,
          sessionId: SESSION_ID,
          kind: 'turn',
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          recordedAt: at({ day: DAY_TWO, time: '09:58:00' }),
          inputTokens: 5_600,
          outputTokens: 1_180,
          estimatedCostUsd: 0.22,
        },
        {
          id: 'mock-run-telemetry-summarizer-early' as TelemetryRecordId,
          runId: 'mock-run-provider-run-summarizer' as ProviderRunId,
          sessionId: SESSION_ID,
          kind: 'summarizer',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          recordedAt: at({ day: DAY_ONE, time: '09:48:00' }),
          inputTokens: 1_340,
          outputTokens: 310,
          estimatedCostUsd: 0.009,
        },
        {
          id: 'mock-run-telemetry-summarizer-latest' as TelemetryRecordId,
          runId: 'mock-run-provider-run-summarizer' as ProviderRunId,
          sessionId: SESSION_ID,
          kind: 'summarizer',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          recordedAt: at({ day: DAY_TWO, time: '10:04:00' }),
          inputTokens: 2_680,
          outputTokens: 540,
          estimatedCostUsd: 0.016,
        },
      ],
    },
    sessionExternalTasks: { [SESSION_ID]: [] },
    sessionGithub: {
      [SESSION_ID]: {
        ...EMPTY_GITHUB,
        pr: PAYMENTS_PR,
      },
    },
    sessionProjectPrs: {
      [SESSION_ID]: {
        [PAYMENTS_ID]: [PAYMENTS_PR],
        [CONSOLE_ID]: [CONSOLE_PR],
      },
    },
    selectedAgentId: { [SESSION_ID]: CONSOLE_BANNER_AGENT_ID },
    activeLens: { [SESSION_ID]: null },
    workspaceIntegrations: { [WORKSPACE_ID]: [] },
    sessionAttachments: { [SESSION_ID]: [] },
    slotHistory: { [SESSION_ID]: {} },
    slotHistoryCounts: { [SESSION_ID]: {} },
    setFocusedGithubIssueNumber: () => undefined,
    openExternalTaskLens: () => undefined,
    loadSessionArtifacts: async () => undefined,
    loadSessionEvents: async () => undefined,
    loadSessionAnsweredQuestions: async () => undefined,
    loadSessionDismissedQuestions: async () => undefined,
    setActiveLens: () => undefined,
    loadConsumptionsForPlan: async () => undefined,
    selectAgent: async () => undefined,
    setFocusedPlanId: () => undefined,
  });
};
