import type {
  IsoDateTime,
  ParallelGroupId,
  ParallelSessionId,
  ProviderRunId,
  SessionId,
  StepId,
  TaskId,
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

export type SessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

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

export type Session = Readonly<{
  id: SessionId;
  taskId: TaskId;
  stepId?: StepId;
  ordinal: number;
  name: string;
  status: SessionStatus;
  runId?: ProviderRunId;
  outputSummary?: string;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
}>;

export type StepTransition = Readonly<{
  fromOrdinal: number;
  toOrdinal: number;
  carryForwardContext: string;
  at: IsoDateTime;
}>;

export interface ParallelGroup {
  readonly id: ParallelGroupId;
  readonly taskId: TaskId;
  readonly ordinal: number;
  readonly mergeStrategy: ParallelMergeStrategy;
  readonly createdAt: IsoDateTime;
  readonly completedAt: IsoDateTime | null;
}

export interface ParallelSession {
  readonly id: ParallelSessionId;
  readonly groupId: ParallelGroupId;
  readonly stepId: StepId;
  readonly parallelIndex: number;
  readonly runId: ProviderRunId;
  readonly status: SessionStatus;
  readonly worktreePath: string;
  readonly outputSummary: string | null;
  readonly startedAt: IsoDateTime;
  readonly completedAt: IsoDateTime | null;
}
