import { parentIdsOf } from './parentIdsOf';
import type { SpawnedRow } from './spawnedRow';

export type FoldedSpawnedRow = Readonly<{
  row: SpawnedRow;
  count: number;
  isExpanded: boolean;
}>;

type Params = {
  readonly rows: ReadonlyArray<SpawnedRow>;
  readonly expanded: Readonly<Record<string, boolean>>;
  readonly isOpenByDefault: boolean;
};

export const foldSpawnedRowsOf = ({
  rows,
  expanded,
  isOpenByDefault,
}: Params): ReadonlyArray<FoldedSpawnedRow> => {
  const countById = new Map<string, number>();
  for (const parentId of parentIdsOf({ nodes: rows }).values()) {
    if (parentId !== null) {
      countById.set(parentId, (countById.get(parentId) ?? 0) + 1);
    }
  }
  const shown: FoldedSpawnedRow[] = [];
  let hiddenUnder: number | null = null;
  for (const row of rows) {
    if (hiddenUnder !== null && row.level > hiddenUnder) {
      continue;
    }
    hiddenUnder = null;
    const count = countById.get(row.id) ?? 0;
    const isExpanded = expanded[row.id] ?? isOpenByDefault;
    shown.push({ row, count, isExpanded });
    if (count > 0 && !isExpanded) {
      hiddenUnder = row.level;
    }
  }
  return shown;
};
