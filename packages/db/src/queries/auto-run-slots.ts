import type { AutoDelegationId, AutoTreeId } from '@goodboy/types';
import type { Database, GuardedStatement } from '../client';
import { autoBudgetLeftSql } from './auto-reservations';

type TreeRefParams = {
  readonly treeRef: string;
};

const autoRunningChildrenSql = ({ treeRef }: TreeRefParams): string =>
  `(SELECT COUNT(*) FROM auto_attempts AS live
     JOIN auto_delegations AS holder ON holder.id = live.delegation_id
     WHERE holder.tree_id = ${treeRef}
       AND holder.state IN ('starting', 'running')
       AND live.state IN ('starting', 'running'))`;

type CountRunningParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const countAutoRunningChildren = async ({
  db,
  treeId,
}: CountRunningParams): Promise<number> => {
  const rows = await db.select<{ readonly running: number }>(
    `SELECT ${autoRunningChildrenSql({ treeRef: '?' })} AS running`,
    [treeId],
  );
  return rows[0]?.running ?? 0;
};

type TakeRunSlotStatementParams = {
  readonly delegationId: AutoDelegationId;
  readonly generation: number;
  readonly maxRunning: number;
  readonly deadlineAt: number;
  readonly abortCode: string;
};

export const autoTakeRunSlotStatement = ({
  delegationId,
  generation,
  maxRunning,
  deadlineAt,
  abortCode,
}: TakeRunSlotStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_delegations SET state = 'starting', deadline_at = ?
    WHERE id = ? AND generation = ? AND state = 'accepted'
      AND ${autoRunningChildrenSql({ treeRef: 'auto_delegations.tree_id' })} < ?
      AND EXISTS (
        SELECT 1 FROM auto_trees
        WHERE auto_trees.id = auto_delegations.tree_id
          AND ${autoBudgetLeftSql({ treeRef: 'auto_trees.id' })}
      )`,
  params: [deadlineAt, delegationId, generation, maxRunning],
  abortWhen: 'noChanges',
  abortCode,
});
