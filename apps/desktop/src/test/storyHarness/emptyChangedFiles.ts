import type { ChangedFilesSummary } from '../../features/worktree/worktree';

export const EMPTY_CHANGED_FILES: ChangedFilesSummary = {
  paths: [],
  entries: [],
  additions: 0,
  deletions: 0,
  numstat: '',
};
