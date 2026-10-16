import type { TerminalWorktree } from '../../terminalWorktrees';

type LabelParams = {
  readonly worktree: TerminalWorktree;
  readonly isBranchless: boolean;
};

export type ScopeLabel = {
  readonly place: string;
  readonly isMono: boolean;
};

export const scopeLabelOf = ({ worktree, isBranchless }: LabelParams): ScopeLabel => {
  if (worktree.kind === 'workspace') {
    return { place: 'Workspace folder', isMono: false };
  }
  if (worktree.kind === 'mount' && worktree.branch !== null) {
    return { place: worktree.branch, isMono: true };
  }
  if (isBranchless) {
    return { place: 'Session folder', isMono: false };
  }
  return { place: worktree.folder ?? worktree.projectName, isMono: false };
};
