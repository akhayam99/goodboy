export const DELETE_REMOVED_LINE = 'Removed: transcript, file versions, images.';

export const DELETE_CANNOT_UNDO = 'This cannot be undone.';

type KeptLineParams = {
  readonly isBranchless: boolean;
};

export const deleteKeptLine = ({ isBranchless }: KeptLineParams): string =>
  isBranchless ? 'Kept: cost.' : 'Kept: branches, cost, uncommitted worktrees.';
