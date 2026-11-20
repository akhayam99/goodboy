import type { Database } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const readLiveDelegationIds = async ({
  db,
  treeId,
}: Params): Promise<ReadonlySet<string>> => {
  const rows = await db.select<{ readonly delegation_id: string }>(
    `SELECT DISTINCT delegation_id FROM auto_attempts
      WHERE tree_id = ? AND state IN ('starting', 'running')`,
    [treeId],
  );
  return new Set(rows.map((row) => row.delegation_id));
};
