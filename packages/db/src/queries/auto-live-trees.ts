import type { Database } from '../client';

type CountRow = {
  readonly live: number;
};

type Params = {
  readonly db: Database;
};

export const countLiveAutoTrees = async ({ db }: Params): Promise<number> => {
  const rows = await db.select<CountRow>(
    `SELECT COUNT(*) AS live FROM auto_trees
     WHERE phase IN ('deciding', 'delegating', 'waiting', 'merging', 'stopping')`,
  );
  return rows[0]?.live ?? 0;
};
