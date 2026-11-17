import type { BoardGroupId, BranchBoard } from './boardTypes';

export type VisibleGroup = Readonly<{
  id: BoardGroupId;
  label: string;
  rowIds: ReadonlyArray<string>;
  hiddenCount: number;
  isFoldable: boolean;
}>;

type Params = {
  readonly board: BranchBoard;
  readonly isMergedExpanded: boolean;
};

export const visibleGroupsOf = ({ board, isMergedExpanded }: Params): ReadonlyArray<VisibleGroup> =>
  board.groups.map((group): VisibleGroup => {
    const isFoldable = group.hiddenCount > 0;
    const rowIds = isFoldable && !isMergedExpanded ? group.visibleRowIds : group.rowIds;
    return {
      id: group.id,
      label: group.label,
      rowIds,
      hiddenCount: group.rowIds.length - rowIds.length,
      isFoldable,
    };
  });
