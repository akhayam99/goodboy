import type { SessionId } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export type ArchivedWorktreeTarget = {
  readonly sessionId: SessionId;
  readonly repoPath: string;
  readonly worktreePath: string;
};

export type StorageStats = {
  readonly databaseBytes: number;
  readonly archivedSessionCount: number;
  readonly archivedTranscriptRows: number;
  readonly archivedTranscriptBytes: number;
  readonly archivedWorktrees: ReadonlyArray<ArchivedWorktreeTarget>;
};

export type WorktreeRemovalResult = {
  readonly removed: number;
  readonly failed: number;
};
