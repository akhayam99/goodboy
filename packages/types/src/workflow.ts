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
import type { ModelEffort, ProviderId } from './provider-registry';
import type { VerbosityLevel } from './settings';

export type AgentEffort = ModelEffort;

export type AgentRole =
  | 'scout'
  | 'planner'
  | 'implementer'
  | 'reviewer'
  | 'investigator'
  | 'tester'
  | 'resolver'
  | 'custom';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type AgentSourceKind = 'review_comment' | 'issue_comment' | 'diff_comment';

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
  deletedAt?: IsoDateTime;
}>;

export type WorkflowOrigin = 'library' | 'custom' | 'orchestrated';

export const WORKFLOW_ORIGINS: ReadonlyArray<WorkflowOrigin> = [
  'library',
  'custom',
  'orchestrated',
];

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
  effort?: ModelEffort;
  modelOverride?: string;
  providerOverride?: ProviderId;
  kind?: string;
  sourceThreadId?: string;
  sourceThreadIds?: ReadonlyArray<string>;
  sourceCommentUrl?: string;
  sourceKind?: AgentSourceKind;
  domains?: ReadonlyArray<string>;
}>;
