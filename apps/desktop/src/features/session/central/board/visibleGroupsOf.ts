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
  readonly expandedGroupIds: ReadonlySet<BoardGroupId>;
};

export const visibleGroupsOf = ({ board, expandedGroupIds }: Params): ReadonlyArray<VisibleGroup> =>
  board.groups.map((group): VisibleGroup => {
    const isFoldable = group.hiddenCount > 0;
    const rowIds =
      isFoldable && !expandedGroupIds.has(group.id) ? group.visibleRowIds : group.rowIds;
    return {
      id: group.id,
      label: group.label,
      rowIds,
      hiddenCount: group.rowIds.length - rowIds.length,
      isFoldable,
    };
  });
