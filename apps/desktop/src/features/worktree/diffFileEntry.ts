import type { FileDiffStatus } from '@goodboy/types';

export type DiffFileEntry = {
  readonly path: string;
  readonly oldPath: string | null;
  readonly status: FileDiffStatus;
  readonly additions: number;
  readonly deletions: number;
  readonly isBinary: boolean;
  readonly isUntracked: boolean;
};
