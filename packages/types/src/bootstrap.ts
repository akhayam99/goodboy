import type { IsoDateTime, SessionId } from './ids';

export type BootstrapStage = 'first-lap' | 'moving' | 'done';

export type BootstrapPhase = {
  readonly stage: BootstrapStage;
  readonly firstLapSessionId: SessionId | null;
  readonly bootstrapSessionId: SessionId | null;
  readonly snapshotId: string | null;
  readonly updatedAt: IsoDateTime;
};
