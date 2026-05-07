import type {
  IsoDateTime,
  ParallelPhaseGroupId,
  ParallelPhaseRunId,
  PhaseDefinitionId,
  PhaseRunId,
  PhaseTemplateId,
  ProviderRunId,
  SessionId,
  WorkspaceId,
} from './ids';
import type { ProviderId } from './provider-registry';

export type PhaseRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type ParallelMergeStrategy = 'last_write_wins' | 'manual' | 'synthesizer_driven';

export type PhaseDefinition = Readonly<{
  id: PhaseDefinitionId;
  templateId: PhaseTemplateId;
  ordinal: number;
  name: string;
  promptPrefix: string;
  providerOverride?: ProviderId;
  modelOverride?: string;
  parallelGroup?: number;
}>;

export type PhaseTemplate = Readonly<{
  id: PhaseTemplateId;
  workspaceId: WorkspaceId;
  name: string;
  description: string;
  definitions: ReadonlyArray<PhaseDefinition>;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type PhaseRun = Readonly<{
  id: PhaseRunId;
  sessionId: SessionId;
  phaseDefinitionId: PhaseDefinitionId;
  ordinal: number;
  name: string;
  status: PhaseRunStatus;
  runId?: ProviderRunId;
  outputSummary?: string;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
}>;

export type PhaseTransition = Readonly<{
  fromOrdinal: number;
  toOrdinal: number;
  carryForwardContext: string;
  at: IsoDateTime;
}>;

export interface ParallelPhaseGroup {
  readonly id: ParallelPhaseGroupId;
  readonly sessionId: SessionId;
  readonly ordinal: number;
  readonly mergeStrategy: ParallelMergeStrategy;
  readonly createdAt: IsoDateTime;
  readonly completedAt: IsoDateTime | null;
}

export interface ParallelPhaseRun {
  readonly id: ParallelPhaseRunId;
  readonly groupId: ParallelPhaseGroupId;
  readonly phaseDefinitionId: PhaseDefinitionId;
  readonly parallelIndex: number;
  readonly runId: ProviderRunId;
  readonly status: PhaseRunStatus;
  readonly worktreePath: string;
  readonly outputSummary: string | null;
  readonly startedAt: IsoDateTime;
  readonly completedAt: IsoDateTime | null;
}
