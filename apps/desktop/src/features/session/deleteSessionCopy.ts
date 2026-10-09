export const DELETE_REMOVED_LINE = 'Removed: transcript, file versions, images.';

export const DELETE_CANNOT_UNDO = 'This cannot be undone.';

export const deleteKeptLine = ({ isBranchless }: { readonly isBranchless: boolean }): string =>
  isBranchless ? 'Kept: cost.' : 'Kept: branches, cost, uncommitted worktrees.';
