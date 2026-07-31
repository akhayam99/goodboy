import type {
  AgentId,
  IsoDateTime,
  ParallelAgentId,
  ParallelGroupId,
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
  | 'custom';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type AgentSourceKind = 'review_comment' | 'issue_comment' | 'diff_comment';

export type ParallelMergeStrategy = 'last_write_wins' | 'manual' | 'synthesizer_driven';

export type StepDef = Readonly<{
  id: StepDefId;
  workspaceId: WorkspaceId | null;
  baseStepId?: StepDefId;
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
  parallelGroup?: number;
  orchestratorReason?: string;
  deletedAt?: IsoDateTime;
}>;

export type Workflow = Readonly<{
  id: WorkflowId;
  workspaceId: WorkspaceId;
  name: string;
  description: string;
  goal?: string;
  processText?: string;
  steps: ReadonlyArray<Step>;
  isPreset?: boolean;
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
  providerOverride?: string;
  kind?: string;
  sourceThreadId?: string;
  sourceThreadIds?: ReadonlyArray<string>;
  sourceCommentUrl?: string;
  sourceKind?: AgentSourceKind;
  domains?: ReadonlyArray<string>;
}>;

export type ParallelGroup = {
  readonly id: ParallelGroupId;
  readonly sessionId: SessionId;
  readonly ordinal: number;
  readonly mergeStrategy: ParallelMergeStrategy;
  readonly createdAt: IsoDateTime;
  readonly completedAt: IsoDateTime | null;
};

export type ParallelAgent = {
  readonly id: ParallelAgentId;
  readonly groupId: ParallelGroupId;
  readonly stepId: StepId;
  readonly workflowRunId?: WorkflowRunId;
  readonly parallelIndex: number;
  readonly runId: ProviderRunId;
  readonly status: AgentStatus;
  readonly worktreePath: string;
  readonly outputSummary: string | null;
  readonly startedAt: IsoDateTime;
  readonly completedAt: IsoDateTime | null;
};
