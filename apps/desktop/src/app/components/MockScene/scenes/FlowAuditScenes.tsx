import { useEffect, useState } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type {
  Agent,
  AgentId,
  AgentStatus,
  IsoDateTime,
  MountId,
  OpenQuestion,
  OpenQuestionId,
  PlanId,
  PlanWithCount,
  Project,
  ProjectId,
  ProjectScript,
  ProjectScriptId,
  ProviderRunId,
  Session,
  SessionId,
  SessionProjectMount,
  Step,
  StepId,
  TelemetryRecord,
  TelemetryRecordId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ProviderInfo } from '../../../../features/providers/providers';
import type { AgentKind } from '../../../../features/session/agent-kind';
import type { WorkflowBuilderDraft } from '../../../../store/slices/workflowDrafts/types';
import { WorkflowBuilderView } from '../../../../features/session/components/WorkflowBuilderView';
import { WorkflowRunDetail } from '../../../../features/session/components/SessionWorkspace/parts/WorkflowRunDetail';
import { OpenQuestionCluster } from '../../../../features/chat/components/ChatView/OpenQuestionCluster';
import { useOpenQuestions } from '../../../../features/context/components/QuestionsTab/useOpenQuestions';
import { ChatImageLoaderProvider } from '../../../../features/chat/components/ChatView/ChatImageLoaderProvider';
import { TranscriptRows } from '../../../../features/chat/components/ChatView/TranscriptRows';
import type { TranscriptRow } from '../../../../features/chat/utils/cluster-operations';
import { CommandPalette } from '../../../../features/session/components/CommandPalette';

const noop = () => undefined;

const NOW = '2026-09-16T11:20:00.000Z' as IsoDateTime;
const EARLIER = '2026-09-16T09:05:00.000Z' as IsoDateTime;

const WORKSPACE_ID = 'mock-flow-workspace-harborline' as WorkspaceId;
const LEDGER_PROJECT_ID = 'mock-flow-project-ledger-core' as ProjectId;
const RELAY_PROJECT_ID = 'mock-flow-project-notify-relay' as ProjectId;
const PAYMENTS_PROJECT_ID = 'mock-flow-project-payments-api' as ProjectId;

const FLOW_SESSION_ID = 'mock-flow-session-settlement' as SessionId;
const CHAT_SESSION_ID = 'mock-flow-session-relay-storm' as SessionId;
const EXPORT_SESSION_ID = 'mock-flow-session-ledger-export' as SessionId;
const PRICING_SESSION_ID = 'mock-flow-session-pricing-tiers' as SessionId;

const DYNAMIC_WORKFLOW_ID = 'mock-flow-workflow-settlement' as WorkflowId;
const DYNAMIC_RUN_ID = 'mock-flow-run-settlement' as WorkflowRunId;
const PRESET_TRACE_ID = 'mock-flow-preset-trace-and-fix' as WorkflowId;
const PRESET_HARDEN_ID = 'mock-flow-preset-harden-endpoint' as WorkflowId;
const PRESET_MIGRATE_ID = 'mock-flow-preset-migrate-contract' as WorkflowId;
const QUEUED_RUN_ID = 'mock-flow-run-harden' as WorkflowRunId;

const STEP_SCOUT_ID = 'mock-flow-step-scout' as StepId;
const STEP_PLAN_ID = 'mock-flow-step-plan' as StepId;
const STEP_ROUNDING_ID = 'mock-flow-step-rounding' as StepId;
const STEP_BACKFILL_ID = 'mock-flow-step-backfill' as StepId;
const STEP_TESTS_ID = 'mock-flow-step-tests' as StepId;

const AGENT_SCOUT_ID = 'mock-flow-agent-scout' as AgentId;
const AGENT_SCOUT_LEDGER_ID = 'mock-flow-agent-scout-ledger' as AgentId;
const AGENT_SCOUT_RELAY_ID = 'mock-flow-agent-scout-relay' as AgentId;
const AGENT_SCOUT_REPORTS_ID = 'mock-flow-agent-scout-reports' as AgentId;
const AGENT_PLAN_ID = 'mock-flow-agent-plan' as AgentId;
const AGENT_ROUNDING_ID = 'mock-flow-agent-rounding' as AgentId;
const AGENT_BACKFILL_ID = 'mock-flow-agent-backfill' as AgentId;
const AGENT_TESTS_ID = 'mock-flow-agent-tests' as AgentId;

const CHAT_AGENT_TRIAGE_ID = 'mock-flow-agent-relay-triage' as AgentId;
const CHAT_AGENT_BACKOFF_ID = 'mock-flow-agent-relay-backoff' as AgentId;
const CHAT_AGENT_RESOLVER_ID = 'mock-flow-agent-relay-resolver' as AgentId;

const QUESTION_STORE_ID = 'mock-flow-question-exemption-store' as OpenQuestionId;
const QUESTION_SIGNALS_ID = 'mock-flow-question-replay-signals' as OpenQuestionId;
const QUESTION_ANSWERED_ID = 'mock-flow-question-error-shape' as OpenQuestionId;

const THREAD_BACKOFF = 'PRRT_thread_retry_backoff';
const THREAD_ERROR_SHAPE = 'PRRT_thread_error_shape';
const THREAD_SPELLING = 'PRRT_thread_field_spelling';

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
  name: 'Harborline',
  slug: 'harborline',
  sessionsRoot: '/mock/harborline/sessions',
  overrides: OVERRIDES,
  createdAt: '2026-09-02T08:30:00.000Z' as IsoDateTime,
  updatedAt: NOW,
};

const PROJECTS: ReadonlyArray<Project> = [
  {
    id: LEDGER_PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    name: 'ledger-core',
    rootPath: '/mock/harborline/ledger-core',
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: EARLIER,
    updatedAt: NOW,
  },
  {
    id: RELAY_PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    name: 'notify-relay',
    rootPath: '/mock/harborline/notify-relay',
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: EARLIER,
    updatedAt: NOW,
  },
  {
    id: PAYMENTS_PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    name: 'payments-api',
    rootPath: '/mock/harborline/payments-api',
    kind: 'repo',
    overrides: OVERRIDES,
    createdAt: EARLIER,
    updatedAt: NOW,
  },
];

type MountSeedParams = Readonly<{
  sessionId: SessionId;
  projectId: ProjectId;
  mountName: string;
  branch: string;
  suffix: string;
}>;

const mountOf = ({
  sessionId,
  projectId,
  mountName,
  branch,
  suffix,
}: MountSeedParams): SessionProjectMount => ({
  projectId,
  mountName,
  worktreePath: `/mock/harborline/${mountName}-${suffix}`,
  repoRoot: `/mock/harborline/${mountName}`,
  branch,
  mountId: `mock-flow-mount-${suffix}-${mountName}` as MountId,
  sessionId,
  lastWorktreePath: null,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
});

const FLOW_MOUNTS: ReadonlyArray<SessionProjectMount> = [
  mountOf({
    sessionId: FLOW_SESSION_ID,
    projectId: LEDGER_PROJECT_ID,
    mountName: 'ledger-core',
    branch: 'ak/fix-settlement-rounding',
    suffix: 'settlement',
  }),
  mountOf({
    sessionId: FLOW_SESSION_ID,
    projectId: PAYMENTS_PROJECT_ID,
    mountName: 'payments-api',
    branch: 'ak/fix-settlement-rounding',
    suffix: 'settlement',
  }),
];

const CHAT_MOUNTS: ReadonlyArray<SessionProjectMount> = [
  mountOf({
    sessionId: CHAT_SESSION_ID,
    projectId: RELAY_PROJECT_ID,
    mountName: 'notify-relay',
    branch: 'ak/fix-retry-storm',
    suffix: 'storm',
  }),
];

const PROVIDERS: ReadonlyArray<ProviderInfo> = [
  {
    id: 'anthropic',
    binary: 'claude',
    capabilities: {
      models: [],
      supportsTools: true,
      supportsStream: true,
      supportsCheapModel: true,
    },
    connection: 'connected',
    version: '2.1.260',
    identity: 'harborline-platform',
    label: 'Claude',
    error: null,
    docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
  },
  {
    id: 'codex',
    binary: 'codex',
    capabilities: {
      models: [],
      supportsTools: true,
      supportsStream: true,
      supportsCheapModel: true,
    },
    connection: 'connected',
    version: '0.58.0',
    identity: 'harborline-platform',
    label: 'Codex',
    error: null,
    docsUrl: 'https://github.com/openai/codex#installation',
  },
  {
    id: 'cursor',
    binary: 'cursor-agent',
    capabilities: {
      models: [],
      supportsTools: true,
      supportsStream: true,
      supportsCheapModel: true,
    },
    connection: 'connected',
    version: '2.1.12',
    identity: 'harborline-platform',
    label: 'Cursor',
    error: null,
    docsUrl: 'https://docs.cursor.com/en/cli/installation',
  },
];

type PresetSeedParams = Readonly<{
  id: WorkflowId;
  name: string;
  description: string;
  goal: string;
  steps: ReadonlyArray<Readonly<{ role: Step['role']; name: string; promptPrefix: string }>>;
}>;

const presetOf = ({ id, name, description, goal, steps }: PresetSeedParams): Workflow => ({
  id,
  workspaceId: WORKSPACE_ID,
  name,
  description,
  goal,
  origin: 'custom',
  isPreset: true,
  steps: steps.map((step, index) => ({
    id: `${id}-step-${index}` as StepId,
    workflowId: id,
    ...(step.role === undefined ? {} : { role: step.role }),
    ordinal: index,
    name: step.name,
    promptPrefix: step.promptPrefix,
  })),
  createdAt: '2026-09-04T10:00:00.000Z' as IsoDateTime,
  updatedAt: EARLIER,
});

const PRESETS: ReadonlyArray<Workflow> = [
  presetOf({
    id: PRESET_TRACE_ID,
    name: 'Trace and fix',
    description: 'Map the failing path, agree the fix, ship it with coverage.',
    goal: 'Find the root cause and land the fix',
    steps: [
      {
        role: 'scout',
        name: 'Trace the failing path',
        promptPrefix: 'Map the code path end to end.',
      },
      { role: 'planner', name: 'Agree the fix', promptPrefix: 'Turn the trace into a fix plan.' },
      { role: 'implementer', name: 'Apply the fix', promptPrefix: 'Implement the agreed fix.' },
      {
        role: 'tester',
        name: 'Cover the regression',
        promptPrefix: 'Add the regression coverage.',
      },
    ],
  }),
  presetOf({
    id: PRESET_HARDEN_ID,
    name: 'Harden an endpoint',
    description: 'Audit validation, rate limits, and error shapes on one endpoint.',
    goal: 'Harden a public endpoint',
    steps: [
      {
        role: 'scout',
        name: 'Audit the endpoint',
        promptPrefix: 'Read the handler and its callers.',
      },
      {
        role: 'implementer',
        name: 'Tighten validation',
        promptPrefix: 'Close the validation gaps.',
      },
      {
        role: 'tester',
        name: 'Prove the limits hold',
        promptPrefix: 'Cover the rejected requests.',
      },
    ],
  }),
  presetOf({
    id: PRESET_MIGRATE_ID,
    name: 'Migrate a contract',
    description: 'Version a contract, migrate callers, retire the old shape.',
    goal: 'Move every caller to the new contract',
    steps: [
      {
        role: 'scout',
        name: 'Find every caller',
        promptPrefix: 'List the callers of the old shape.',
      },
      {
        role: 'planner',
        name: 'Sequence the migration',
        promptPrefix: 'Order the caller migrations.',
      },
      {
        role: 'implementer',
        name: 'Migrate the callers',
        promptPrefix: 'Move callers to the new shape.',
      },
      {
        role: 'reviewer',
        name: 'Check the retirement',
        promptPrefix: 'Confirm the old shape is unused.',
      },
      { role: 'tester', name: 'Cover both shapes', promptPrefix: 'Test the migration window.' },
    ],
  }),
];

const DYNAMIC_STEPS: ReadonlyArray<Step> = [
  {
    id: STEP_SCOUT_ID,
    workflowId: DYNAMIC_WORKFLOW_ID,
    role: 'scout',
    ordinal: 0,
    name: 'Trace where the rounding happens',
    promptPrefix:
      'Follow a settlement batch from posting to payout and record every rounding call.',
    orchestratorReason:
      'Nothing in the goal says where the drift enters, so the first step buys the map rather than guessing at a fix.',
  },
  {
    id: STEP_PLAN_ID,
    workflowId: DYNAMIC_WORKFLOW_ID,
    role: 'planner',
    ordinal: 1,
    name: 'Agree where rounding belongs',
    promptPrefix: 'Turn the trace into one decision about where the batch is rounded.',
    orchestratorReason:
      'The scout found three rounding sites, so the choice between them is a decision to write down before any code moves.',
  },
  {
    id: STEP_ROUNDING_ID,
    workflowId: DYNAMIC_WORKFLOW_ID,
    role: 'implementer',
    ordinal: 2,
    name: 'Round once per batch in ledger-core',
    promptPrefix: 'Move rounding out of the per line path and into the batch total.',
    orchestratorReason:
      'The plan is unambiguous and touches one module, so a single implementer is cheaper than splitting the edit.',
  },
  {
    id: STEP_BACKFILL_ID,
    workflowId: DYNAMIC_WORKFLOW_ID,
    role: 'implementer',
    ordinal: 3,
    name: 'Backfill the settled batches behind a flag',
    promptPrefix: 'Replay the last quarter of settled batches behind a dry run flag.',
    orchestratorReason:
      'Fixing forward leaves the settled quarter wrong, and the backfill is independent enough to run as its own step.',
  },
  {
    id: STEP_TESTS_ID,
    workflowId: DYNAMIC_WORKFLOW_ID,
    role: 'tester',
    ordinal: 4,
    name: 'Cover the half cent cases',
    promptPrefix: 'Cover exact halves, negative adjustments, and mixed currency batches.',
    orchestratorReason:
      'The half cent case is the one the report flagged, so the run does not close until a test pins it.',
  },
];

const DYNAMIC_WORKFLOW: Workflow = {
  id: DYNAMIC_WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Settlement rounding recovery',
  description: 'Orchestrated run that finds the drift, fixes it, and replays the settled batches.',
  goal: 'Stop the settlement rounding drift and repair the quarter already settled',
  processText:
    'Find where a settlement batch gets rounded, decide on one rounding site, fix it, then replay the settled batches behind a dry run flag. Stop if the replay would change a payout that is already reconciled.',
  origin: 'orchestrated',
  isPreset: false,
  steps: DYNAMIC_STEPS,
  createdAt: '2026-09-16T09:12:00.000Z' as IsoDateTime,
  updatedAt: NOW,
};

const DYNAMIC_RUN: WorkflowRun = {
  id: DYNAMIC_RUN_ID,
  workflowId: DYNAMIC_WORKFLOW_ID,
  ordinal: 1,
  currentStep: 3,
  autoRun: true,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  orchestratorHints: 'Open one PR per project and keep the dry run flag off by default.',
  orchestratorSummary:
    'Rounding now happens once per batch in ledger-core and the payout reader was left alone. The backfill is replaying the settled quarter behind a dry run flag, and the half cent cases still need coverage.',
  orchestratorRouting: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
  spendLimitUsd: 12,
  spendLimitMode: 'pause',
  goal: 'Stop the settlement rounding drift and repair the quarter already settled',
  createdAt: '2026-09-16T09:12:00.000Z' as IsoDateTime,
};

const QUEUED_RUN: WorkflowRun = {
  id: QUEUED_RUN_ID,
  workflowId: PRESET_HARDEN_ID,
  ordinal: 2,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'manual',
  executionMode: 'static',
  goal: 'Harden the payout webhook before the backfill lands',
  createdAt: '2026-09-16T10:48:00.000Z' as IsoDateTime,
};

type FlowAgentParams = Readonly<{
  id: AgentId;
  stepId: StepId;
  ordinal: number;
  name: string;
  kind: AgentKind;
  status: AgentStatus;
  runId: ProviderRunId;
  outputSummary: string;
  startedAt: IsoDateTime;
  completedAt?: IsoDateTime;
  parentAgentId?: AgentId;
}>;

const flowAgentOf = ({
  id,
  stepId,
  ordinal,
  name,
  kind,
  status,
  runId,
  outputSummary,
  startedAt,
  completedAt,
  parentAgentId,
}: FlowAgentParams): Agent => ({
  id,
  sessionId: FLOW_SESSION_ID,
  stepId,
  workflowRunId: DYNAMIC_RUN_ID,
  ...(parentAgentId === undefined ? {} : { parentAgentId }),
  ordinal,
  name,
  kind,
  status,
  runId,
  outputSummary,
  startedAt,
  ...(completedAt === undefined
    ? {}
    : {
        completedAt,
        lastFinishedAt: completedAt,
        lastViewedAt: NOW,
        doneAt: completedAt,
      }),
});

const FLOW_AGENTS: ReadonlyArray<Agent> = [
  flowAgentOf({
    id: AGENT_SCOUT_ID,
    stepId: STEP_SCOUT_ID,
    ordinal: 0,
    name: 'Trace where the rounding happens',
    kind: 'scout',
    status: 'completed',
    runId: 'mock-flow-provider-run-scout' as ProviderRunId,
    outputSummary:
      'Three rounding sites: the line posting, the batch total, and the payout reader.',
    startedAt: '2026-09-16T09:14:00.000Z' as IsoDateTime,
    completedAt: '2026-09-16T09:29:00.000Z' as IsoDateTime,
  }),
  flowAgentOf({
    id: AGENT_SCOUT_LEDGER_ID,
    stepId: STEP_SCOUT_ID,
    ordinal: 0.1,
    name: 'Read the posting path in ledger-core',
    kind: 'scout',
    status: 'completed',
    runId: 'mock-flow-provider-run-scout-ledger' as ProviderRunId,
    outputSummary: 'postLine rounds every amount before the batch total is ever computed.',
    startedAt: '2026-09-16T09:15:00.000Z' as IsoDateTime,
    completedAt: '2026-09-16T09:24:00.000Z' as IsoDateTime,
    parentAgentId: AGENT_SCOUT_ID,
  }),
  flowAgentOf({
    id: AGENT_SCOUT_REPORTS_ID,
    stepId: STEP_SCOUT_ID,
    ordinal: 0.2,
    name: 'Read the payout reader in payments-api',
    kind: 'scout',
    status: 'completed',
    runId: 'mock-flow-provider-run-scout-reports' as ProviderRunId,
    outputSummary:
      'The payout reader rounds again for display only, so it is not part of the drift.',
    startedAt: '2026-09-16T09:15:30.000Z' as IsoDateTime,
    completedAt: '2026-09-16T09:26:00.000Z' as IsoDateTime,
    parentAgentId: AGENT_SCOUT_ID,
  }),
  flowAgentOf({
    id: AGENT_SCOUT_RELAY_ID,
    stepId: STEP_SCOUT_ID,
    ordinal: 0.3,
    name: 'Check the settlement notices in notify-relay',
    kind: 'scout',
    status: 'completed',
    runId: 'mock-flow-provider-run-scout-relay' as ProviderRunId,
    outputSummary:
      'Notices quote the batch total verbatim, so they inherit whatever the ledger writes.',
    startedAt: '2026-09-16T09:16:00.000Z' as IsoDateTime,
    completedAt: '2026-09-16T09:27:00.000Z' as IsoDateTime,
    parentAgentId: AGENT_SCOUT_ID,
  }),
  flowAgentOf({
    id: AGENT_PLAN_ID,
    stepId: STEP_PLAN_ID,
    ordinal: 1,
    name: 'Agree where rounding belongs',
    kind: 'planner',
    status: 'completed',
    runId: 'mock-flow-provider-run-plan' as ProviderRunId,
    outputSummary:
      'Round once on the batch total, half even, and leave the display rounding alone.',
    startedAt: '2026-09-16T09:31:00.000Z' as IsoDateTime,
    completedAt: '2026-09-16T09:41:00.000Z' as IsoDateTime,
  }),
  flowAgentOf({
    id: AGENT_ROUNDING_ID,
    stepId: STEP_ROUNDING_ID,
    ordinal: 2,
    name: 'Round once per batch in ledger-core',
    kind: 'implementer',
    status: 'completed',
    runId: 'mock-flow-provider-run-rounding' as ProviderRunId,
    outputSummary: 'Rounding moved to settleBatch, 41 call sites unchanged, ledger tests green.',
    startedAt: '2026-09-16T09:44:00.000Z' as IsoDateTime,
    completedAt: '2026-09-16T10:31:00.000Z' as IsoDateTime,
  }),
  flowAgentOf({
    id: AGENT_BACKFILL_ID,
    stepId: STEP_BACKFILL_ID,
    ordinal: 3,
    name: 'Backfill the settled batches behind a flag',
    kind: 'implementer',
    status: 'running',
    runId: 'mock-flow-provider-run-backfill' as ProviderRunId,
    outputSummary:
      'Replaying the settled quarter with the dry run flag on and diffing each payout.',
    startedAt: '2026-09-16T10:34:00.000Z' as IsoDateTime,
  }),
  flowAgentOf({
    id: AGENT_TESTS_ID,
    stepId: STEP_TESTS_ID,
    ordinal: 4,
    name: 'Cover the half cent cases',
    kind: 'tester',
    status: 'pending',
    runId: 'mock-flow-provider-run-tests' as ProviderRunId,
    outputSummary: '',
    startedAt: NOW,
  }),
];

const FLOW_AGENT_KINDS: Readonly<Record<string, AgentKind>> = {
  [AGENT_SCOUT_ID]: 'scout',
  [AGENT_SCOUT_LEDGER_ID]: 'scout',
  [AGENT_SCOUT_REPORTS_ID]: 'scout',
  [AGENT_SCOUT_RELAY_ID]: 'scout',
  [AGENT_PLAN_ID]: 'planner',
  [AGENT_ROUNDING_ID]: 'implementer',
  [AGENT_BACKFILL_ID]: 'implementer',
  [AGENT_TESTS_ID]: 'tester',
};

const FLOW_AGENT_MODELS: Readonly<Record<string, string>> = {
  [AGENT_SCOUT_ID]: 'gpt-5.6-luna',
  [AGENT_SCOUT_LEDGER_ID]: 'gpt-5.6-luna',
  [AGENT_SCOUT_REPORTS_ID]: 'gpt-5.6-luna',
  [AGENT_SCOUT_RELAY_ID]: 'gpt-5.6-luna',
  [AGENT_PLAN_ID]: 'gpt-6-astra',
  [AGENT_ROUNDING_ID]: 'gpt-5.6-sol',
  [AGENT_BACKFILL_ID]: 'gpt-5.6-sol',
  [AGENT_TESTS_ID]: 'composer-2.5-fast',
};

const FLOW_AGENT_PROVIDERS: Readonly<Record<string, ProviderInfo['id']>> = {
  [AGENT_SCOUT_ID]: 'codex',
  [AGENT_SCOUT_LEDGER_ID]: 'codex',
  [AGENT_SCOUT_REPORTS_ID]: 'codex',
  [AGENT_SCOUT_RELAY_ID]: 'codex',
  [AGENT_PLAN_ID]: 'codex',
  [AGENT_ROUNDING_ID]: 'codex',
  [AGENT_BACKFILL_ID]: 'codex',
  [AGENT_TESTS_ID]: 'cursor',
};

type TelemetrySeedParams = Readonly<{
  id: string;
  runId: ProviderRunId;
  recordedAt: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}>;

const telemetryOf = ({
  id,
  runId,
  recordedAt,
  inputTokens,
  outputTokens,
  estimatedCostUsd,
}: TelemetrySeedParams): TelemetryRecord => ({
  id: id as TelemetryRecordId,
  runId,
  sessionId: FLOW_SESSION_ID,
  kind: 'turn',
  provider: 'codex',
  model: 'gpt-5.6-sol',
  recordedAt: recordedAt as IsoDateTime,
  inputTokens,
  outputTokens,
  estimatedCostUsd,
});

const FLOW_TELEMETRY: ReadonlyArray<TelemetryRecord> = [
  telemetryOf({
    id: 'mock-flow-telemetry-scout',
    runId: 'mock-flow-provider-run-scout' as ProviderRunId,
    recordedAt: '2026-09-16T09:29:00.000Z',
    inputTokens: 38_420,
    outputTokens: 5_120,
    estimatedCostUsd: 0.412,
  }),
  telemetryOf({
    id: 'mock-flow-telemetry-scout-ledger',
    runId: 'mock-flow-provider-run-scout-ledger' as ProviderRunId,
    recordedAt: '2026-09-16T09:24:00.000Z',
    inputTokens: 21_050,
    outputTokens: 2_980,
    estimatedCostUsd: 0.221,
  }),
  telemetryOf({
    id: 'mock-flow-telemetry-scout-reports',
    runId: 'mock-flow-provider-run-scout-reports' as ProviderRunId,
    recordedAt: '2026-09-16T09:26:00.000Z',
    inputTokens: 18_640,
    outputTokens: 2_410,
    estimatedCostUsd: 0.196,
  }),
  telemetryOf({
    id: 'mock-flow-telemetry-scout-relay',
    runId: 'mock-flow-provider-run-scout-relay' as ProviderRunId,
    recordedAt: '2026-09-16T09:27:00.000Z',
    inputTokens: 14_880,
    outputTokens: 1_960,
    estimatedCostUsd: 0.158,
  }),
  telemetryOf({
    id: 'mock-flow-telemetry-plan',
    runId: 'mock-flow-provider-run-plan' as ProviderRunId,
    recordedAt: '2026-09-16T09:41:00.000Z',
    inputTokens: 26_310,
    outputTokens: 4_470,
    estimatedCostUsd: 0.508,
  }),
  telemetryOf({
    id: 'mock-flow-telemetry-rounding',
    runId: 'mock-flow-provider-run-rounding' as ProviderRunId,
    recordedAt: '2026-09-16T10:31:00.000Z',
    inputTokens: 92_740,
    outputTokens: 16_220,
    estimatedCostUsd: 1.864,
  }),
  telemetryOf({
    id: 'mock-flow-telemetry-backfill',
    runId: 'mock-flow-provider-run-backfill' as ProviderRunId,
    recordedAt: '2026-09-16T11:18:00.000Z',
    inputTokens: 61_180,
    outputTokens: 9_340,
    estimatedCostUsd: 1.117,
  }),
];

type SessionSeedParams = Readonly<{
  id: SessionId;
  goal: string;
  state: Session['state'];
  workflowRuns: ReadonlyArray<WorkflowRun>;
  activeProjectId: ProjectId;
  updatedAt: IsoDateTime;
}>;

const sessionOf = ({
  id,
  goal,
  state,
  workflowRuns,
  activeProjectId,
  updatedAt,
}: SessionSeedParams): Session => ({
  id,
  workspaceId: WORKSPACE_ID,
  goal,
  state,
  contextSlots: [{ key: 'goal', value: goal, enabled: true }],
  providerPreference: { defaultProvider: 'codex', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns,
  autoRun: true,
  titleUserEdited: true,
  activeProjectId,
  createdAt: EARLIER,
  updatedAt,
});

const FLOW_SESSION: Session = sessionOf({
  id: FLOW_SESSION_ID,
  goal: 'Stop the settlement rounding drift and repair the quarter already settled',
  state: {
    kind: 'running',
    runId: 'mock-flow-provider-run-backfill' as ProviderRunId,
    startedAt: '2026-09-16T10:34:00.000Z' as IsoDateTime,
  },
  workflowRuns: [DYNAMIC_RUN, QUEUED_RUN],
  activeProjectId: LEDGER_PROJECT_ID,
  updatedAt: NOW,
});

const CHAT_SESSION: Session = sessionOf({
  id: CHAT_SESSION_ID,
  goal: 'Hold the retry storm at the relay without dropping a settlement notice',
  state: { kind: 'idle', lastActivityAt: '2026-09-16T11:06:00.000Z' as IsoDateTime },
  workflowRuns: [],
  activeProjectId: RELAY_PROJECT_ID,
  updatedAt: '2026-09-16T11:06:00.000Z' as IsoDateTime,
});

const OTHER_SESSIONS: ReadonlyArray<Session> = [
  sessionOf({
    id: EXPORT_SESSION_ID,
    goal: 'Add monthly ledger exports for the finance close',
    state: { kind: 'idle', lastActivityAt: '2026-09-16T08:41:00.000Z' as IsoDateTime },
    workflowRuns: [],
    activeProjectId: LEDGER_PROJECT_ID,
    updatedAt: '2026-09-16T08:41:00.000Z' as IsoDateTime,
  }),
  sessionOf({
    id: PRICING_SESSION_ID,
    goal: 'Move tiered pricing behind the new rate table',
    state: { kind: 'ended', endedAt: '2026-09-15T18:22:00.000Z' as IsoDateTime },
    workflowRuns: [],
    activeProjectId: PAYMENTS_PROJECT_ID,
    updatedAt: '2026-09-15T18:22:00.000Z' as IsoDateTime,
  }),
];

const SESSIONS: ReadonlyArray<Session> = [FLOW_SESSION, CHAT_SESSION, ...OTHER_SESSIONS];

const CHAT_AGENTS: ReadonlyArray<Agent> = [
  {
    id: CHAT_AGENT_TRIAGE_ID,
    sessionId: CHAT_SESSION_ID,
    ordinal: 0,
    name: 'Triage the retry storm',
    kind: 'scout',
    status: 'completed',
    runId: 'mock-flow-provider-run-triage' as ProviderRunId,
    outputSummary: 'Every failed notice retries on a fixed 200ms timer with no jitter and no cap.',
    startedAt: '2026-09-16T10:02:00.000Z' as IsoDateTime,
    completedAt: '2026-09-16T10:14:00.000Z' as IsoDateTime,
    lastFinishedAt: '2026-09-16T10:14:00.000Z' as IsoDateTime,
    lastViewedAt: NOW,
    doneAt: '2026-09-16T10:14:00.000Z' as IsoDateTime,
    modelOverride: 'gpt-5.6-luna',
    providerOverride: 'codex',
  },
  {
    id: CHAT_AGENT_BACKOFF_ID,
    sessionId: CHAT_SESSION_ID,
    ordinal: 1,
    name: 'Add jittered backoff to the relay',
    kind: 'implementer',
    status: 'completed',
    runId: 'mock-flow-provider-run-relay-backoff' as ProviderRunId,
    outputSummary: 'Exponential backoff with full jitter, capped at eight attempts and 90 seconds.',
    startedAt: '2026-09-16T10:18:00.000Z' as IsoDateTime,
    completedAt: '2026-09-16T10:55:00.000Z' as IsoDateTime,
    lastFinishedAt: '2026-09-16T10:55:00.000Z' as IsoDateTime,
    lastViewedAt: NOW,
    doneAt: '2026-09-16T10:55:00.000Z' as IsoDateTime,
    modelOverride: 'gpt-5.6-sol',
    providerOverride: 'codex',
  },
  {
    id: CHAT_AGENT_RESOLVER_ID,
    sessionId: CHAT_SESSION_ID,
    ordinal: 2,
    name: 'Resolve review on payments-api#412',
    kind: 'resolver',
    status: 'completed',
    runId: 'mock-flow-provider-run-relay-resolver' as ProviderRunId,
    outputSummary: 'Three review threads triaged, one fix committed, one explained, one declined.',
    startedAt: '2026-09-16T11:00:00.000Z' as IsoDateTime,
    completedAt: '2026-09-16T11:06:00.000Z' as IsoDateTime,
    lastFinishedAt: '2026-09-16T11:06:00.000Z' as IsoDateTime,
    lastViewedAt: NOW,
    doneAt: '2026-09-16T11:06:00.000Z' as IsoDateTime,
    modelOverride: 'claude-sonnet-4-5',
    providerOverride: 'anthropic',
  },
];

const SCRIPTS: ReadonlyArray<ProjectScript> = [
  {
    id: 'mock-flow-script-settlement-replay' as ProjectScriptId,
    projectId: LEDGER_PROJECT_ID,
    name: 'Replay a settlement batch',
    body: 'pnpm --filter ledger-core settle:replay --dry-run',
    sortOrder: 0,
    createdAt: EARLIER,
    updatedAt: EARLIER,
  },
  {
    id: 'mock-flow-script-relay-smoke' as ProjectScriptId,
    projectId: RELAY_PROJECT_ID,
    name: 'Smoke the notice relay',
    body: 'pnpm --filter notify-relay smoke',
    sortOrder: 1,
    createdAt: EARLIER,
    updatedAt: EARLIER,
  },
];

const BUILDER_DRAFT: WorkflowBuilderDraft = {
  mode: 'dynamic',
  goalText:
    'Stop the settlement rounding drift and repair the quarter that already settled, without touching a reconciled payout',
  goalHistory: ['Fix the rounding bug in settlements'],
  selectedPresetId: null,
  basePresetId: null,
  processText:
    'Find where a settlement batch gets rounded, decide on one rounding site, fix it there, then replay the settled batches behind a dry run flag. Stop and ask before any replay that would change a payout marked reconciled.',
  plan: null,
  workflow: {
    name: '',
    description: '',
    goal: '',
    steps: [],
    origin: 'custom',
    isPreset: false,
  },
  saveAsPreset: false,
  autoRun: true,
  dynamicName: 'Settlement rounding recovery',
  dynamicNameEdited: true,
  orchestratorModel: {
    providerOverride: 'codex',
    modelOverride: 'gpt-5.6-sol',
    effortOverride: 'high',
  },
};

const OPEN_QUESTIONS: ReadonlyArray<OpenQuestion> = [
  {
    id: QUESTION_STORE_ID,
    sessionId: CHAT_SESSION_ID,
    createdByAgentId: CHAT_AGENT_TRIAGE_ID,
    text: 'Which clock should the backoff use when the relay and the payments host disagree?',
    suggestedAnswers: [
      'The relay clock, it owns the retry schedule',
      'The payments host clock, it owns the deadline',
      'Whichever is later, so nothing retries early',
    ],
    recommendedAnswer: 'The relay clock, it owns the retry schedule',
    selectMode: 'one',
    userAnswer: null,
    status: 'open',
    createdAt: '2026-09-16T10:12:00.000Z' as IsoDateTime,
  },
  {
    id: QUESTION_SIGNALS_ID,
    sessionId: CHAT_SESSION_ID,
    createdByAgentId: CHAT_AGENT_BACKOFF_ID,
    text: 'Which failures should count as retryable for a settlement notice?',
    suggestedAnswers: [
      'Connection resets',
      'HTTP 429 with a retry hint',
      'HTTP 502 and 503',
      'Read timeouts past 30 seconds',
      'Signature mismatches',
    ],
    selectMode: 'many',
    userAnswer: null,
    status: 'open',
    createdAt: '2026-09-16T10:44:00.000Z' as IsoDateTime,
  },
  {
    id: QUESTION_ANSWERED_ID,
    sessionId: CHAT_SESSION_ID,
    createdByAgentId: CHAT_AGENT_TRIAGE_ID,
    text: 'Should a dropped notice raise a page or land in the dead letter queue?',
    suggestedAnswers: ['Page on drop', 'Dead letter queue with a daily digest'],
    recommendedAnswer: 'Dead letter queue with a daily digest',
    selectMode: 'one',
    userAnswer: 'Dead letter queue with a daily digest, and page only when the queue passes 50.',
    status: 'answered',
    createdAt: '2026-09-16T10:06:00.000Z' as IsoDateTime,
    answeredAt: '2026-09-16T10:09:00.000Z' as IsoDateTime,
  },
];

const PLAN_MESSAGE = [
  'The drift is not in the payout reader. Every posting rounds itself, so a batch of 3,100 lines',
  'accumulates a half cent of error per line before the total is ever computed.',
  '',
  '<<plan>>',
  '# Round once per settlement batch',
  '',
  '1. Take the rounding out of `postLine` and keep the raw minor units on the line.',
  '2. Round the batch total in `settleBatch`, half even, once.',
  '3. Leave the payout reader alone, its rounding is display only.',
  '4. Replay the settled quarter behind a dry run flag and diff every payout.',
  '<</plan>>',
].join('\n');

const RESOLVER_MESSAGE = [
  'Three review threads on payments-api#412 are triaged.',
  '',
  `<<comment-resolved threadid="${THREAD_BACKOFF}" commitsha="9f2c1ab">>`,
  `<<comment-analysis threadid="${THREAD_ERROR_SHAPE}" verdict="fix" summary="the 409 body drops the retry hint the relay reads">>`,
  `<<comment-wontfix threadid="${THREAD_SPELLING}" reason="the field is spelled this way across the whole settlement schema">>`,
].join('\n');

const CHAT_PLANS: ReadonlyArray<PlanWithCount> = [
  {
    id: 'mock-flow-plan-rounding' as PlanId,
    sessionId: CHAT_SESSION_ID,
    agentId: CHAT_AGENT_TRIAGE_ID,
    title: 'Round once per settlement batch',
    bodyMd: PLAN_MESSAGE,
    status: 'active',
    createdAt: '2026-09-16T10:31:00.000Z' as IsoDateTime,
    updatedAt: '2026-09-16T10:31:00.000Z' as IsoDateTime,
    consumptionCount: 0,
  },
];

const TRANSCRIPT_ROWS: ReadonlyArray<TranscriptRow> = [
  {
    kind: 'item',
    key: 'mock-flow-transcript-user',
    item: {
      kind: 'user_text',
      key: 'mock-flow-transcript-user',
      text: 'Settlement totals are off by a few cents per batch. Find it, then clean up the review on payments-api#412.',
      at: '2026-09-16T10:00:00.000Z' as IsoDateTime,
      provider: 'codex',
      model: 'gpt-5.6-sol',
    },
  },
  {
    kind: 'item',
    key: 'mock-flow-transcript-plan',
    item: { kind: 'assistant_text', key: 'mock-flow-transcript-plan', text: PLAN_MESSAGE },
  },
  {
    kind: 'item',
    key: 'mock-flow-transcript-report',
    item: {
      kind: 'artifact_block',
      key: 'mock-flow-transcript-report',
      artifactKind: 'report',
      title: 'Where the settlement cents go',
      complete: true,
    },
  },
  {
    kind: 'item',
    key: 'mock-flow-transcript-wireframe',
    item: {
      kind: 'artifact_block',
      key: 'mock-flow-transcript-wireframe',
      artifactKind: 'wireframe',
      title: 'Settlement replay review screen',
      complete: true,
    },
  },
  {
    kind: 'item',
    key: 'mock-flow-transcript-resolver',
    item: { kind: 'assistant_text', key: 'mock-flow-transcript-resolver', text: RESOLVER_MESSAGE },
  },
];

const seedFlowAuditBase = () => {
  useAppStore.setState({
    workspaces: [WORKSPACE],
    currentWorkspaceId: WORKSPACE_ID,
    projects: PROJECTS,
    sessions: SESSIONS,
    providers: PROVIDERS,
    workspaceOverrides: { [WORKSPACE_ID]: OVERRIDES },
    phaseTemplates: { [WORKSPACE_ID]: PRESETS },
    projectScripts: { [WORKSPACE_ID]: SCRIPTS },
    sessionProjectMounts: {
      [FLOW_SESSION_ID]: FLOW_MOUNTS,
      [CHAT_SESSION_ID]: CHAT_MOUNTS,
    },
    sessionActiveProject: {
      [FLOW_SESSION_ID]: LEDGER_PROJECT_ID,
      [CHAT_SESSION_ID]: RELAY_PROJECT_ID,
    },
    sessionWorktrees: {
      [FLOW_SESSION_ID]: FLOW_MOUNTS.map((mount) => mount.worktreePath),
      [CHAT_SESSION_ID]: CHAT_MOUNTS.map((mount) => mount.worktreePath),
    },
    sessionBranches: {
      [FLOW_SESSION_ID]: 'ak/fix-settlement-rounding',
      [CHAT_SESSION_ID]: 'ak/fix-retry-storm',
      [EXPORT_SESSION_ID]: 'ak/feat-monthly-ledger-export',
      [PRICING_SESSION_ID]: 'ak/refactor-rate-table',
    },
    sessionWorktreeRecords: {
      [FLOW_SESSION_ID]: FLOW_MOUNTS.map((mount, index) => ({
        id: `mock-flow-worktree-${index}`,
        sessionId: FLOW_SESSION_ID,
        worktreePath: mount.worktreePath,
        branch: mount.branch,
        parallelIndex: index,
        projectId: mount.projectId,
        mountName: mount.mountName,
        repoSlug: `harborline/${mount.mountName}`,
        createdAt: Date.parse(EARLIER),
      })),
      [CHAT_SESSION_ID]: CHAT_MOUNTS.map((mount, index) => ({
        id: `mock-flow-chat-worktree-${index}`,
        sessionId: CHAT_SESSION_ID,
        worktreePath: mount.worktreePath,
        branch: mount.branch,
        parallelIndex: index,
        projectId: mount.projectId,
        mountName: mount.mountName,
        repoSlug: `harborline/${mount.mountName}`,
        createdAt: Date.parse(EARLIER),
      })),
    },
    sessionSlots: {
      [FLOW_SESSION_ID]: FLOW_SESSION.contextSlots,
      [CHAT_SESSION_ID]: CHAT_SESSION.contextSlots,
    },
    sessionSlotsLoad: { [FLOW_SESSION_ID]: 'loaded', [CHAT_SESSION_ID]: 'loaded' },
    sessionLoading: {
      [FLOW_SESSION_ID]: {
        agents: false,
        transcript: false,
        telemetry: false,
        slots: false,
        plans: false,
        summary: false,
      },
      [CHAT_SESSION_ID]: {
        agents: false,
        transcript: false,
        telemetry: false,
        slots: false,
        plans: false,
        summary: false,
      },
    },
    summarizerStatus: {
      [FLOW_SESSION_ID]: {
        status: 'idle',
        lastUpdate: NOW,
        error: null,
        lastUsage: null,
        lastAttempt: null,
      },
      [CHAT_SESSION_ID]: {
        status: 'idle',
        lastUpdate: NOW,
        error: null,
        lastUsage: null,
        lastAttempt: null,
      },
    },
    sessionAttachments: { [FLOW_SESSION_ID]: [], [CHAT_SESSION_ID]: [] },
    workflowRunAttachments: {},
    workspaceIntegrations: { [WORKSPACE_ID]: [] },
    scriptRuns: {},
    activeLens: { [FLOW_SESSION_ID]: null, [CHAT_SESSION_ID]: null },
    loadGoalAttachments: async () => undefined,
    loadSessionEvents: async () => undefined,
    loadSessionArtifacts: async () => undefined,
    setActiveLens: noop,
    selectAgent: async () => undefined,
  });
};

const seedWorkflowBuilder = () => {
  seedFlowAuditBase();
  useAppStore.setState({
    currentSessionId: FLOW_SESSION_ID,
    workflowDrafts: { [FLOW_SESSION_ID]: BUILDER_DRAFT },
    sessionPhaseRuns: { [FLOW_SESSION_ID]: FLOW_AGENTS, [CHAT_SESSION_ID]: CHAT_AGENTS },
    sessionWorkflows: { [FLOW_SESSION_ID]: [DYNAMIC_WORKFLOW] },
    sessionTelemetry: { [FLOW_SESSION_ID]: FLOW_TELEMETRY },
    agentKindOverride: FLOW_AGENT_KINDS,
  });
};

const seedWorkflowRun = () => {
  seedFlowAuditBase();
  useAppStore.setState({
    currentSessionId: FLOW_SESSION_ID,
    sessionPhaseRuns: { [FLOW_SESSION_ID]: FLOW_AGENTS, [CHAT_SESSION_ID]: CHAT_AGENTS },
    sessionWorkflows: { [FLOW_SESSION_ID]: [DYNAMIC_WORKFLOW] },
    sessionTelemetry: { [FLOW_SESSION_ID]: FLOW_TELEMETRY },
    agentKindOverride: FLOW_AGENT_KINDS,
    agentModelOverride: FLOW_AGENT_MODELS,
    agentProviderOverride: FLOW_AGENT_PROVIDERS,
    agentRunHistory: {},
    agentTurnState: {
      [AGENT_BACKFILL_ID]: {
        kind: 'running',
        runId: 'mock-flow-provider-run-backfill' as ProviderRunId,
        startedAt: '2026-09-16T10:34:00.000Z' as IsoDateTime,
      },
    },
    orchestratingWorkflowRuns: { [DYNAMIC_RUN_ID]: false },
    selectedAgentId: { [FLOW_SESSION_ID]: AGENT_ROUNDING_ID },
    focusedWorkflowRunId: { [FLOW_SESSION_ID]: DYNAMIC_RUN_ID },
    sessionOpenQuestions: { [FLOW_SESSION_ID]: [] },
    budgetAlerts: [],
  });
};

const seedChatSurfaces = () => {
  seedFlowAuditBase();
  useAppStore.setState({
    currentSessionId: CHAT_SESSION_ID,
    sessionPhaseRuns: { [CHAT_SESSION_ID]: CHAT_AGENTS },
    sessionWorkflows: { [CHAT_SESSION_ID]: [] },
    sessionOpenQuestions: { [CHAT_SESSION_ID]: OPEN_QUESTIONS },
    selectedAgentId: { [CHAT_SESSION_ID]: CHAT_AGENT_RESOLVER_ID },
    sessionPlans: { [CHAT_SESSION_ID]: CHAT_PLANS },
    sessionResolveThreads: { [CHAT_SESSION_ID]: [] },
    sessionGithub: {
      [CHAT_SESSION_ID]: {
        linkedIssues: [],
        pr: null,
        fetchedAt: NOW,
        failedAt: null,
        loading: false,
        error: null,
        detail: {
          prNumber: 412,
          comments: [
            {
              id: 'mock-flow-comment-backoff',
              author: 'kwatanabe',
              authorAvatarUrl: null,
              body: 'The retry timer has no jitter, a single outage will synchronize every relay.',
              createdAt: '2026-09-16T09:52:00.000Z',
              url: 'https://example.invalid/harborline/payments-api/pull/412#discussion_1',
              source: 'review',
              path: 'src/relay/retry.ts',
              line: 64,
              resolved: true,
              threadId: THREAD_BACKOFF,
            },
            {
              id: 'mock-flow-comment-error-shape',
              author: 'a-delgado',
              authorAvatarUrl: null,
              body: 'A 409 here loses the retry hint, the relay cannot tell a duplicate from a conflict.',
              createdAt: '2026-09-16T09:58:00.000Z',
              url: 'https://example.invalid/harborline/payments-api/pull/412#discussion_2',
              source: 'review',
              path: 'src/settlement/handler.ts',
              line: 118,
              resolved: false,
              threadId: THREAD_ERROR_SHAPE,
            },
            {
              id: 'mock-flow-comment-spelling',
              author: 'kwatanabe',
              authorAvatarUrl: null,
              body: 'Field name reads oddly here.',
              createdAt: '2026-09-16T10:01:00.000Z',
              url: 'https://example.invalid/harborline/payments-api/pull/412#discussion_3',
              source: 'review',
              path: 'src/settlement/schema.ts',
              line: 22,
              resolved: false,
              threadId: THREAD_SPELLING,
            },
          ],
          reviews: [],
          reviewRequests: [],
          checks: [],
        },
        detailFetchedAt: NOW,
        detailLoading: false,
        detailError: null,
      },
    },
  });
  useOpenQuestions.setState({
    drafts: {
      [QUESTION_SIGNALS_ID]: {
        selectedSuggestions: ['Connection resets', 'HTTP 429 with a retry hint'],
        customAnswer: '',
        showCustomField: false,
      },
    },
    justAnswered: [],
  });
};

type ExpandParams = Readonly<{
  isReady: boolean;
  selector: string;
}>;

const useAutoExpand = ({ isReady, selector }: ExpandParams) => {
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const interval = window.setInterval(() => {
      const toggle = window.document.querySelector<HTMLButtonElement>(selector);
      if (toggle === null) {
        return;
      }
      if (toggle.getAttribute('aria-expanded') !== 'true') {
        toggle.click();
      }
      window.clearInterval(interval);
    }, 120);
    return () => window.clearInterval(interval);
  }, [isReady, selector]);
};

export const WorkflowBuilderScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedWorkflowBuilder();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <WorkflowBuilderView session={FLOW_SESSION} onClose={noop} />
    </main>
  );
};

export const WorkflowRunScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedWorkflowRun();
    setIsReady(true);
  }, []);

  useAutoExpand({ isReady, selector: '[data-testid="workflow-orchestrator-decisions-toggle"]' });

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <WorkflowRunDetail session={FLOW_SESSION} workflowRunId={DYNAMIC_RUN_ID} />
    </main>
  );
};

export const OpenQuestionsScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedChatSurfaces();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-auto bg-background text-foreground">
      <div className={cn(PANE_RHYTHM.column, PANE_RHYTHM.measure.chat, PANE_RHYTHM.body)}>
        <OpenQuestionCluster
          questions={OPEN_QUESTIONS}
          sessionId={CHAT_SESSION_ID}
          viewerAgentId={null}
        />
      </div>
    </main>
  );
};

const TranscriptFeed = () => (
  <ul
    className={cn('flex flex-col gap-2.5', PANE_RHYTHM.column, PANE_RHYTHM.measure.chat)}
    aria-live="polite"
    aria-relevant="additions"
  >
    <ChatImageLoaderProvider sessionId={CHAT_SESSION_ID}>
      <TranscriptRows
        rows={TRANSCRIPT_ROWS}
        oqByTurnOrdinal={new Map()}
        sessionId={CHAT_SESSION_ID}
        selectedAgentId={CHAT_AGENT_RESOLVER_ID}
        workingDir={CHAT_MOUNTS[0]?.worktreePath ?? null}
        onRefreshAuth={noop}
        onOpenDiff={noop}
        isThinking={false}
        thinkingContext="think"
        onRetryError={noop}
        retryingErrorRunId={null}
      />
    </ChatImageLoaderProvider>
  </ul>
);

export const TranscriptScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedChatSurfaces();
    setIsReady(true);
  }, []);

  useAutoExpand({ isReady, selector: '[aria-label="Expand resolve findings"]' });

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-auto bg-background text-foreground">
      <div className={PANE_RHYTHM.body}>
        <TranscriptFeed />
      </div>
    </main>
  );
};

export const CommandPaletteScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedChatSurfaces();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="h-screen overflow-hidden bg-background text-foreground">
      <div className={PANE_RHYTHM.body}>
        <TranscriptFeed />
      </div>
      <CommandPalette
        onClose={noop}
        onOpenSettings={noop}
        onNewSession={noop}
        onOpenProviders={noop}
        onOpenShortcutHelp={noop}
      />
    </main>
  );
};
