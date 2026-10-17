import type { WorktreeStatus } from '@goodboy/types';

type Params = {
  readonly behind?: number;
  readonly ahead?: number;
  readonly unmerged?: number;
  readonly inProgress?: WorktreeStatus['inProgress'];
};

export const worktreeStatusOf = ({
  behind = 0,
  ahead = 0,
  unmerged = 0,
  inProgress = null,
}: Params): WorktreeStatus => ({
  branch: 'goodboy/session',
  head: null,
  headSubject: null,
  upstream: 'origin/goodboy/session',
  upstreamDistance: { kind: 'known', ahead, behind: 0 },
  mainDistance: { kind: 'known', ahead: 1, behind },
  workingTree: {
    kind: 'known',
    staged: 0,
    unstaged: 0,
    untracked: 0,
    unmerged,
    changed: unmerged,
  },
  inProgress,
});
