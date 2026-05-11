import type { IsoDateTime, ProviderRunId, TaskId, WorkflowId, WorkspaceId } from './ids';
import type { TaskProviderPreference } from './provider-preference';
import type { ClaudePermissionMode } from './permission';

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

export type ContextSlotAuthor = 'user' | 'summarizer';

export type ContextSlotHistoryEntry = Readonly<{
  id: string;
  key: string;
  value: string;
  author: ContextSlotAuthor;
  createdAt: IsoDateTime;
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
  permissionMode: ClaudePermissionMode;
  workflowId?: WorkflowId;
  currentStepOrdinal?: number;
  autoRun: boolean;
  titleUserEdited: boolean;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;
