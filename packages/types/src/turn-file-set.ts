import type { MountId, ProviderRunId, SessionId } from './ids';

export type TurnFileStatus = 'added' | 'modified' | 'deleted';

export type TurnFile = Readonly<{
  path: string;
  status: TurnFileStatus;
  additions: number | null;
  deletions: number | null;
}>;

export type TurnFileSet = Readonly<{
  runId: ProviderRunId;
  mountId: MountId;
  sessionId: SessionId;
  own: ReadonlyArray<TurnFile>;
  fromBase: ReadonlyArray<string>;
  isPartial: boolean;
  recordedAtMs: number;
}>;
