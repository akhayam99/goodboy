import type { FileVersionId, IsoDateTime, ProviderRunId, SessionId } from './ids';

export type FileVersionChangeKind = 'modified' | 'deleted';

export type FileVersionSnapshotSource = 'agent_turn' | 'restore';

export type FileVersion = Readonly<{
  id: FileVersionId;
  sessionId: SessionId;
  relativePath: string;
  storedName: string;
  sizeBytes: number;
  contentHash: string;
  changeKind: FileVersionChangeKind;
  snapshotSource: FileVersionSnapshotSource;
  providerRunId?: ProviderRunId;
  capturedAt: IsoDateTime;
}>;
