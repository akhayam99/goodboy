export const DISCARD_FIX_ERROR = {
  missing: 'This comment is no longer in Comments',
  decided: 'Undo the decision on this comment first',
  noFix: 'This comment has no proposed fix to discard',
  onBranch:
    "This fix is already on the branch, so it can't be discarded. Revert it on the branch first",
  sharedDecided:
    'This fix also answers a comment you already decided. Undo that decision first, or keep the fix',
  otherWorktree: 'This fix was made in another worktree. Open that branch to discard it',
} as const;
