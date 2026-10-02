import type { IsoDateTime, SessionId } from './ids';

export type BootstrapStage = 'first-lap' | 'moving' | 'done';

export type BootstrapPhase = {
  readonly stage: BootstrapStage;
  readonly firstLapSessionId: SessionId | null;
  readonly bootstrapSessionId: SessionId | null;
  readonly snapshotId: string | null;
  readonly worktreePath: string | null;
  readonly branch: string | null;
  readonly updatedAt: IsoDateTime;
};

export type BootstrapFileChange = 'added' | 'modified' | 'deleted' | 'type-changed';

export type BootstrapMovedFile = {
  readonly path: string;
  readonly change: BootstrapFileChange;
  readonly size: number;
};

export type BootstrapPrepared = {
  readonly snapshotId: string;
  readonly snapshotRef: string;
  readonly worktreePath: string;
  readonly branch: string;
  readonly baseBranch: string;
  readonly files: ReadonlyArray<BootstrapMovedFile>;
  readonly largeFiles: ReadonlyArray<string>;
  readonly ignoredAtRisk: {
    readonly count: number;
    readonly samples: ReadonlyArray<string>;
  };
};

export type BootstrapClearReport = {
  readonly cleared: ReadonlyArray<string>;
  readonly kept: ReadonlyArray<string>;
};

export type BootstrapAlignOutcome =
  | { readonly kind: 'already-aligned' }
  | { readonly kind: 'fast-forwarded' }
  | { readonly kind: 'reset' }
  | { readonly kind: 'skipped'; readonly reason: string };

export type BootstrapRecoverState =
  | { readonly kind: 'verified' }
  | { readonly kind: 'worktree-missing' }
  | { readonly kind: 'mismatch'; readonly paths: ReadonlyArray<string> };
