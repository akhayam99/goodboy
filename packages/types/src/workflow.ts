import type {
  AgentId,
  IsoDateTime,
  ParallelAgentId,
  ParallelGroupId,
  ProviderRunId,
  SessionId,
  StepId,
  WorkflowId,
  WorkspaceId,
} from './ids';
import type { ProviderId } from './provider-registry';

export type AgentEffort = 'low' | 'medium' | 'high' | 'extra-high' | 'max';

export type AgentRole =
  | 'scout'
  | 'planner'
  | 'implementer'
  | 'reviewer'
  | 'investigator'
  | 'product'
  | 'architect'
  | 'tester'
  | 'explorer'
  | 'custom';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type ParallelMergeStrategy = 'last_write_wins' | 'manual' | 'synthesizer_driven';

export type Step = Readonly<{
  id: StepId;
  workflowId: WorkflowId;
  ordinal: number;
  name: string;
  promptPrefix: string;
  providerOverride?: ProviderId;
  modelOverride?: string;
  effort?: AgentEffort;
  verbosity?: 'brief' | 'normal' | 'verbose';
  parallelGroup?: number;
}>;

export type Workflow = Readonly<{
  id: WorkflowId;
  workspaceId: WorkspaceId;
  name: string;
  description: string;
  steps: ReadonlyArray<Step>;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type Agent = Readonly<{
  id: AgentId;
  sessionId: SessionId;
  stepId?: StepId;
  ordinal: number;
  name: string;
  status: AgentStatus;
  runId?: ProviderRunId;
  outputSummary?: string;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  // Provider-side conversation id captured from the CLI's `system` init event
  // (currently only claude). Threaded back via `--resume` on subsequent turns
  // so the provider keeps full prior-turn context across one-shot invocations.
  providerSessionId?: string;
  // Timestamp of the last terminal transition (completed/failed/skipped). Used
  // with `lastViewedAt` to derive an "unread response" indicator in the sidebar.
  lastFinishedAt?: IsoDateTime;
  // Timestamp of when the user last selected this agent in the sidebar. Unread
  // = `lastFinishedAt > lastViewedAt`.
  lastViewedAt?: IsoDateTime;
  // Soft-delete: non-null means agent was deleted by the user; hidden from
  // normal lists but row preserved for audit / restore.
  deletedAt?: IsoDateTime;
  // Per-agent runtime config (overrides workspace/session defaults). Moved
  // from localStorage into the DB so it survives reload and cross-device sync.
  verbosity?: 'brief' | 'normal' | 'verbose';
  effort?: 'low' | 'medium' | 'high' | 'extra-high' | 'max';
  modelOverride?: string;
  providerOverride?: string;
  kind?: string;
}>;

export type StepTransition = Readonly<{
  fromOrdinal: number;
  toOrdinal: number;
  carryForwardContext: string;
  at: IsoDateTime;
}>;

export interface ParallelGroup {
  readonly id: ParallelGroupId;
  readonly sessionId: SessionId;
  readonly ordinal: number;
  readonly mergeStrategy: ParallelMergeStrategy;
  readonly createdAt: IsoDateTime;
  readonly completedAt: IsoDateTime | null;
}

export interface ParallelAgent {
  readonly id: ParallelAgentId;
  readonly groupId: ParallelGroupId;
  readonly stepId: StepId;
  readonly parallelIndex: number;
  readonly runId: ProviderRunId;
  readonly status: AgentStatus;
  readonly worktreePath: string;
  readonly outputSummary: string | null;
  readonly startedAt: IsoDateTime;
  readonly completedAt: IsoDateTime | null;
}
