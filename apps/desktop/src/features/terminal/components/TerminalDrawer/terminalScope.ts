import type { TerminalWorktree } from '../../terminalWorktrees';

type LabelParams = {
  readonly worktree: TerminalWorktree;
  readonly isBranchless: boolean;
};

export type ScopeLabel = {
  readonly project: string | null;
  readonly place: string;
  readonly isMono: boolean;
};

export const scopeLabelOf = ({ worktree, isBranchless }: LabelParams): ScopeLabel => {
  if (worktree.kind === 'workspace') {
    return { project: null, place: 'Workspace folder', isMono: false };
  }
  if (worktree.kind === 'mount' && worktree.branch !== null) {
    return { project: worktree.projectName, place: worktree.branch, isMono: true };
  }
  if (isBranchless) {
    return { project: null, place: 'Session folder', isMono: false };
  }
  return { project: null, place: worktree.folder ?? worktree.projectName, isMono: false };
};
