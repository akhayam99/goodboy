import type {
  IsoDateTime,
  PhaseDefinitionId,
  PhaseRunId,
  PhaseTemplateId,
  ProviderRunId,
  SessionId,
  WorkspaceId,
} from './ids';
import type { ProviderId } from './provider-registry';

export type PhaseRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type PhaseDefinition = Readonly<{
  id: PhaseDefinitionId;
  templateId: PhaseTemplateId;
  ordinal: number;
  name: string;
  promptPrefix: string;
  providerOverride?: ProviderId;
  modelOverride?: string;
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
  carryForwardContext: boolean;
  at: IsoDateTime;
}>;
