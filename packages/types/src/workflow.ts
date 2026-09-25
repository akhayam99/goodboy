import type {
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  StepDefId,
  StepId,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from './ids';
import type { EffortLevel, ProviderId } from './provider-registry';
import type { VerbosityLevel } from './settings';
import type {
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowTaskProfile,
} from './workflow-routing';

export type AgentEffort = EffortLevel;

export type AgentRole =
  | 'scout'
  | 'planner'
  | 'implementer'
  | 'reviewer'
  | 'investigator'
  | 'tester'
  | 'resolver'
  | 'docs'
  | 'report'
  | 'wireframe'
  | 'custom';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'skipped';

export type AgentSourceKind = 'review_comment' | 'issue_comment' | 'diff_comment' | 'open_question';

export type StepDef = Readonly<{
  id: StepDefId;
  workspaceId: WorkspaceId;
  baseStepId?: StepDefId;
  role: AgentRole;
  name: string;
  promptPrefix: string;
  expectedOutput?: string;
  providerDefault?: ProviderId;
  modelDefault?: string;
  effortDefault?: AgentEffort;
  verbosityDefault?: VerbosityLevel;
  deletedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

const STEP_SIZES = ['small', 'medium', 'large'] as const;

export type StepSize = (typeof STEP_SIZES)[number];

export const isStepSize = (value: unknown): value is StepSize =>
  typeof value === 'string' && STEP_SIZES.some((size) => size === value);

export type Step = Readonly<{
  id: StepId;
  workflowId: WorkflowId;
  libraryStepId?: StepDefId;
  role?: AgentRole;
  ordinal: number;
  name: string;
  promptPrefix: string;
  expectedOutput?: string;
  providerOverride?: ProviderId;
  modelOverride?: string;
  effort?: AgentEffort;
  verbosity?: VerbosityLevel;
  orchestratorReason?: string;
  routingLock?: WorkflowRoutingLock | null;
  routingDecision?: WorkflowRoutingDecision | null;
  taskProfile?: WorkflowTaskProfile | null;
  size?: StepSize;
  deletedAt?: IsoDateTime;
}>;

export const WORKFLOW_ORIGINS = ['library', 'custom', 'orchestrated'] as const;

export type WorkflowOrigin = (typeof WORKFLOW_ORIGINS)[number];

export const isWorkflowOrigin = (value: unknown): value is WorkflowOrigin =>
  typeof value === 'string' && WORKFLOW_ORIGINS.some((origin) => origin === value);

export type Workflow = Readonly<{
  id: WorkflowId;
  workspaceId: WorkspaceId;
  name: string;
  description: string;
  goal?: string;
  processText?: string;
  steps: ReadonlyArray<Step>;
  isPreset?: boolean;
  origin?: WorkflowOrigin;
  deletedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type Agent = Readonly<{
  id: AgentId;
  sessionId: SessionId;
  stepId?: StepId;
  workflowRunId?: WorkflowRunId;
  parentAgentId?: AgentId;
  ordinal: number;
  name: string;
  status: AgentStatus;
  runId?: ProviderRunId;
  outputSummary?: string;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  providerSessionId?: string;
  providerSessionProviderId?: ProviderId;
  lastFinishedAt?: IsoDateTime;
  lastViewedAt?: IsoDateTime;
  doneAt?: IsoDateTime;
  deletedAt?: IsoDateTime;
  verbosity?: VerbosityLevel;
  effort?: EffortLevel;
  modelOverride?: string;
  providerOverride?: ProviderId;
  kind?: string;
  sourceThreadId?: string;
  sourceThreadIds?: ReadonlyArray<string>;
  sourceCommentUrl?: string;
  sourceKind?: AgentSourceKind;
  domains?: ReadonlyArray<string>;
  routingLock?: WorkflowRoutingLock | null;
  routingDecision?: WorkflowRoutingDecision | null;
  taskProfile?: WorkflowTaskProfile | null;
}>;
