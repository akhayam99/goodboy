export const DISCARD_FIX_ERROR = {
  missing: 'This comment is no longer in Comments',
  decided: 'Undo the decision on this comment first',
  noFix: 'This comment has no proposed fix to discard',
  onBranch:
    'This fix is already on the branch, so it cannot be discarded here. Revert it on the branch first',
  shared: 'This fix also answers other comments. Discard it from each of them, or keep it',
  otherWorktree: 'This fix was made in another worktree. Open that branch to discard it',
} as const;
