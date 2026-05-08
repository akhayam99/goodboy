import type { IsoDateTime, ProviderRunId, TaskId, WorkflowId, WorkspaceId } from './ids';
import type { TaskProviderPreference } from './provider-preference';

export type Workspace = Readonly<{
  id: WorkspaceId;
  name: string;
  rootPath: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type ContextSlot = Readonly<{
  key: string;
  value: string;
  enabled: boolean;
}>;

export type TurnState =
  | { kind: 'draft' }
  | { kind: 'starting'; startedAt: IsoDateTime }
  | { kind: 'idle'; lastActivityAt: IsoDateTime }
  | { kind: 'running'; runId: ProviderRunId; startedAt: IsoDateTime }
  | { kind: 'error'; message: string; failedAt: IsoDateTime }
  | { kind: 'ended'; endedAt: IsoDateTime };

export type Task = Readonly<{
  id: TaskId;
  workspaceId: WorkspaceId;
  goal: string;
  state: TurnState;
  contextSlots: ReadonlyArray<ContextSlot>;
  providerPreference: TaskProviderPreference;
  workflowId?: WorkflowId;
  currentStepOrdinal?: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;
