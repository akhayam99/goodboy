import type { BoardGroupId, BoardRow, BranchBoard } from './boardTypes';

export type BoardFilter = 'needs-you' | 'checks';

export type VisibleGroup = Readonly<{
  id: BoardGroupId;
  label: string;
  rowIds: ReadonlyArray<string>;
  hiddenCount: number;
  isFoldable: boolean;
}>;

type MatchParams = {
  readonly row: BoardRow;
  readonly filter: BoardFilter | null;
};

export const isRowInFilter = ({ row, filter }: MatchParams): boolean => {
  if (filter === null) {
    return true;
  }
  if (filter === 'needs-you') {
    return row.needsYouIds.length > 0;
  }
  return row.checks === 'failure';
};

type Params = {
  readonly board: BranchBoard;
  readonly filter: BoardFilter | null;
  readonly isMergedExpanded: boolean;
};

export const visibleGroupsOf = ({
  board,
  filter,
  isMergedExpanded,
}: Params): ReadonlyArray<VisibleGroup> => {
  const rowById = new Map(board.rows.map((row) => [row.id, row]));
  return board.groups.flatMap((group): ReadonlyArray<VisibleGroup> => {
    if (filter !== null) {
      const rowIds = group.rowIds.filter((id) => {
        const row = rowById.get(id);
        return row !== undefined && isRowInFilter({ row, filter });
      });
      return rowIds.length === 0
        ? []
        : [{ id: group.id, label: group.label, rowIds, hiddenCount: 0, isFoldable: false }];
    }
    const isFoldable = group.hiddenCount > 0;
    const rowIds = isFoldable && !isMergedExpanded ? group.visibleRowIds : group.rowIds;
    return [
      {
        id: group.id,
        label: group.label,
        rowIds,
        hiddenCount: group.rowIds.length - rowIds.length,
        isFoldable,
      },
    ];
  });
};
