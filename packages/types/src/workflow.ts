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
  WorkflowRoutingProposal,
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

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type ClusterCompletionFindingTarget = 'implementer' | 'planner' | 'investigator' | 'tester';

export type ClusterCompletionFinding = Readonly<{
  reason: string;
  target: ClusterCompletionFindingTarget;
}>;

export type ClusterCompletionHoldReason =
  'missing-outcome' | 'malformed-outcome' | 'foreign-outcome' | 'unresolved-outcome';

export type ClusterCompletionHoldState = 'open' | 'resolved';

export type ClusterCompletionHold = Readonly<{
  id: string;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId | null;
  containerAgentId: AgentId;
  sourceAgentId: AgentId;
  sourceTurnId: string;
  reason: ClusterCompletionHoldReason;
  findings: ReadonlyArray<ClusterCompletionFinding>;
  state: ClusterCompletionHoldState;
  resolutionEvidence: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type CapabilityPurpose = 'discovery' | 'diagnosis' | 'repair' | 'test' | 'replan';

export const CAPABILITY_PURPOSES: ReadonlyArray<CapabilityPurpose> = [
  'discovery',
  'diagnosis',
  'repair',
  'test',
  'replan',
];

export type CapabilityContinuation = 'resume' | 'transfer' | 'handoff';

export const CAPABILITY_CONTINUATIONS: ReadonlyArray<CapabilityContinuation> = [
  'resume',
  'transfer',
  'handoff',
];

export type AgentExecutionPurpose =
  'cluster' | 'fan-out' | 'capability' | 'question-delegate' | 'standalone';

export const AGENT_EXECUTION_PURPOSES: ReadonlyArray<AgentExecutionPurpose> = [
  'cluster',
  'fan-out',
  'capability',
  'question-delegate',
  'standalone',
];

export type CapabilityObligationState = 'open' | 'granted' | 'satisfied' | 'refused';

export type CapabilityObligationDecision = 'granted' | 'refused' | 'attached' | 'refinement';

export type CapabilityRequest = Readonly<{
  id: string;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId | null;
  obligationId: string;
  requesterAgentId: AgentId;
  sourceTurnId: string;
  targetRole: AgentRole;
  purpose: CapabilityPurpose;
  question: string;
  scope: ReadonlyArray<string>;
  evidenceRefs: ReadonlyArray<string>;
  gap: string;
  expectedOutput: string;
  continuation: CapabilityContinuation;
  routingProposal: WorkflowRoutingProposal | null;
  inventoryRevision: string;
  createdAt: string;
}>;

export type CapabilityObligation = Readonly<{
  id: string;
  sessionId: SessionId;
  workflowRunId: WorkflowRunId | null;
  identity: string;
  requesterAgentId: AgentId;
  targetRole: AgentRole;
  purpose: CapabilityPurpose;
  state: CapabilityObligationState;
  ownerAgentId: AgentId | null;
  decision: CapabilityObligationDecision | null;
  childAgentId: AgentId | null;
  deliveredAt: string | null;
  deliveryReceipt: string | null;
  requests: ReadonlyArray<CapabilityRequest>;
  holdIds: ReadonlyArray<string>;
  createdAt: string;
  updatedAt: string;
}>;

export type AgentSourceKind = 'review_comment' | 'issue_comment' | 'diff_comment' | 'open_question';

export type StepDef = Readonly<{
  id: StepDefId;
  workspaceId: WorkspaceId | null;
  role: AgentRole;
  name: string;
  promptPrefix: string;
  providerDefault?: ProviderId;
  modelDefault?: string;
  effortDefault?: AgentEffort;
  verbosityDefault?: VerbosityLevel;
  deletedAt?: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

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
  executionPurpose?: AgentExecutionPurpose | null;
  sourceThreadId?: string;
  sourceThreadIds?: ReadonlyArray<string>;
  sourceCommentUrl?: string;
  sourceKind?: AgentSourceKind;
  domains?: ReadonlyArray<string>;
  routingLock?: WorkflowRoutingLock | null;
  routingDecision?: WorkflowRoutingDecision | null;
  taskProfile?: WorkflowTaskProfile | null;
}>;
