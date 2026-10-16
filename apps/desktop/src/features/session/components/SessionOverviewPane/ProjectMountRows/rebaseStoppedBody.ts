import type { WorktreeStatus } from '@goodboy/types';

type Params = {
  readonly status: WorktreeStatus;
};

export const rebaseStoppedBody = ({ status }: Params): string => {
  const conflicts = status.workingTree.kind === 'known' ? status.workingTree.unmerged : 0;
  if (conflicts === 0) {
    return 'A rebase stopped halfway in this worktree.';
  }
  const noun = conflicts === 1 ? '1 file has conflicts' : `${conflicts} files have conflicts`;
  return `A rebase stopped halfway in this worktree, ${noun}.`;
};
