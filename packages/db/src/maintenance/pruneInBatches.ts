import type { Database } from '../client';

type PruneInBatchesParams = {
  readonly db: Database;
  readonly table: string;
  readonly selectRowids: string;
  readonly params: ReadonlyArray<unknown>;
  readonly batchRows: number;
  readonly offsetRows?: number;
};

export const pruneInBatches = async ({
  db,
  table,
  selectRowids,
  params,
  batchRows,
  offsetRows,
}: PruneInBatchesParams): Promise<number> => {
  const bound = [...params, batchRows, ...(offsetRows === undefined ? [] : [offsetRows])];
  let total = 0;
  let deleted = batchRows;
  while (deleted >= batchRows) {
    const result = await db.execute(`DELETE FROM ${table} WHERE rowid IN (${selectRowids})`, bound);
    deleted = result.rowsAffected;
    total += deleted;
  }
  return total;
};
