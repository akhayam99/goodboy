import type { FileDiff } from '@goodboy/types';
import type { DiffFileEntry } from '../../worktree/diffFileEntry';

type Params = {
  readonly entry: DiffFileEntry;
};

export const fileOfEntry = ({ entry }: Params): FileDiff => ({
  path: entry.path,
  ...(entry.oldPath !== null && { oldPath: entry.oldPath }),
  status: entry.status,
  additions: entry.additions,
  deletions: entry.deletions,
  binary: entry.isBinary,
  hunks: [],
});
