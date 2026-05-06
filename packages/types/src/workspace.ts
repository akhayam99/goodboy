import type { IsoDateTime, ProviderRunId, SessionId, WorkspaceId } from './ids';

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

export type SessionState =
  | { kind: 'draft' }
  | { kind: 'starting'; startedAt: IsoDateTime }
  | { kind: 'idle'; lastActivityAt: IsoDateTime }
  | { kind: 'running'; runId: ProviderRunId; startedAt: IsoDateTime }
  | { kind: 'error'; message: string; failedAt: IsoDateTime }
  | { kind: 'ended'; endedAt: IsoDateTime };

export type Session = Readonly<{
  id: SessionId;
  workspaceId: WorkspaceId;
  goal: string;
  state: SessionState;
  contextSlots: ReadonlyArray<ContextSlot>;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;
