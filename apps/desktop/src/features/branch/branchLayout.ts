const BRANCH_TWO_COLUMN_MIN_PX = 900;

export type BranchLayout = 'single' | 'two';

export const branchLayoutOf = ({ widthPx }: { readonly widthPx: number | null }): BranchLayout => {
  if (widthPx === null) {
    return 'two';
  }
  return widthPx >= BRANCH_TWO_COLUMN_MIN_PX ? 'two' : 'single';
};
