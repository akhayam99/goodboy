import type { ProjectId } from '@goodboy/types';
import type { BoardRow, BranchBoard } from './boardTypes';

export type ProjectBlock = Readonly<{
  id: string;
  projectId: ProjectId | null;
  projectName: string | null;
  rowIds: ReadonlyArray<string>;
  hiddenCount: number;
  isFoldable: boolean;
}>;

type Params = {
  readonly board: BranchBoard;
  readonly rowById: ReadonlyMap<string, BoardRow>;
  readonly expandedIds: ReadonlySet<string>;
};

type Bucket = {
  projectId: ProjectId | null;
  projectName: string | null;
  rowIds: Array<string>;
  hiddenIds: Array<string>;
};

const NO_PROJECT_ID = 'no-project';

export const projectBlocksOf = ({
  board,
  rowById,
  expandedIds,
}: Params): ReadonlyArray<ProjectBlock> => {
  const buckets = new Map<string, Bucket>();
  for (const group of board.groups) {
    const shown = new Set(group.visibleRowIds);
    for (const rowId of group.rowIds) {
      const row = rowById.get(rowId);
      const projectId = row?.projectId ?? null;
      const key = projectId ?? NO_PROJECT_ID;
      const bucket = buckets.get(key) ?? {
        projectId,
        projectName: row?.projectName ?? null,
        rowIds: [],
        hiddenIds: [],
      };
      buckets.set(key, bucket);
      bucket.rowIds.push(rowId);
      if (!shown.has(rowId)) {
        bucket.hiddenIds.push(rowId);
      }
    }
  }
  return [...buckets.entries()].map(([id, bucket]) => {
    const isFoldable = bucket.hiddenIds.length > 0;
    const isExpanded = expandedIds.has(id);
    const hidden = new Set(bucket.hiddenIds);
    const rowIds =
      isFoldable && !isExpanded
        ? bucket.rowIds.filter((rowId) => !hidden.has(rowId))
        : bucket.rowIds;
    return {
      id,
      projectId: bucket.projectId,
      projectName: bucket.projectName,
      rowIds,
      hiddenCount: bucket.rowIds.length - rowIds.length,
      isFoldable,
    };
  });
};
