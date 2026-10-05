const BRANCH_TWO_COLUMN_MIN_PX = 900;
const BRANCH_RAIL_MIN_PX = 1040;

export type BranchLayout = 'single' | 'two' | 'three';

export const branchLayoutOf = ({ widthPx }: { readonly widthPx: number | null }): BranchLayout => {
  if (widthPx === null) {
    return 'two';
  }
  if (widthPx >= BRANCH_RAIL_MIN_PX) {
    return 'three';
  }
  return widthPx >= BRANCH_TWO_COLUMN_MIN_PX ? 'two' : 'single';
};
