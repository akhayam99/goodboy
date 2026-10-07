import type { WorktreeStatus } from '@goodboy/types';
import { CTX_STATUS } from './contextBranch';
import { BRANCH_FILES_PATCH } from './contextDiffPatch';
import type { FakeHandlers } from './fakeTauri';

const CLEAN_STATUS: WorktreeStatus = {
  ...CTX_STATUS,
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 0, behind: 0 },
};

const EDITS_ONLY_STATUS: WorktreeStatus = {
  ...CLEAN_STATUS,
  workingTree: { kind: 'known', staged: 0, unstaged: 2, untracked: 0, unmerged: 0, changed: 2 },
};

export const CLEAN_HANDLERS: FakeHandlers = {
  worktree_diff: () => '',
  worktree_diff_working: () => '',
  worktree_commits: () => [],
  worktree_status: () => CLEAN_STATUS,
};

export const EDITS_ONLY_HANDLERS: FakeHandlers = {
  worktree_diff: () => '',
  worktree_diff_working: () => BRANCH_FILES_PATCH,
  worktree_commits: () => [],
  worktree_status: () => EDITS_ONLY_STATUS,
};
