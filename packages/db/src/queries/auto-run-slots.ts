import type { AutoDelegationId, AutoTreeId } from '@goodboy/types';
import type { Database, GuardedStatement } from '../client';
import { autoBudgetLeftSql } from './auto-reservations';
import { AUTO_OWNER_GUARD_SQL, autoOwnerGuardParams } from './auto-trees';

type TreeRefParams = {
  readonly treeRef: string;
};

const autoRunningChildrenSql = ({ treeRef }: TreeRefParams): string =>
  `(SELECT COUNT(*) FROM auto_attempts AS live
     JOIN auto_delegations AS holder ON holder.id = live.delegation_id
     WHERE holder.tree_id = ${treeRef}
       AND holder.state IN ('starting', 'running')
       AND live.state IN ('starting', 'running'))`;

export type AutoRunSlots = Readonly<{
  running: number;
  freedAt: number;
}>;

type ReadRunSlotsParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
};

export const readAutoRunSlots = async ({
  db,
  treeId,
}: ReadRunSlotsParams): Promise<AutoRunSlots> => {
  const rows = await db.select<{ readonly running: number; readonly freed_at: number }>(
    `SELECT ${autoRunningChildrenSql({ treeRef: '?' })} AS running,
       MAX(
         COALESCE((SELECT MAX(ended_at) FROM auto_attempts WHERE tree_id = ?), 0),
         COALESCE((SELECT MAX(settled_at) FROM auto_delegations WHERE tree_id = ?), 0)
       ) AS freed_at`,
    [treeId, treeId, treeId],
  );
  return { running: rows[0]?.running ?? 0, freedAt: rows[0]?.freed_at ?? 0 };
};

type KeepRunSlotStatementParams = {
  readonly delegationId: AutoDelegationId;
  readonly generation: number;
  readonly deadlineAt: number;
  readonly abortCode: string;
};

export const autoKeepRunSlotStatement = ({
  delegationId,
  generation,
  deadlineAt,
  abortCode,
}: KeepRunSlotStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_delegations SET state = 'starting', deadline_at = ?
    WHERE id = ? AND generation = ? AND state IN ('starting', 'running') AND is_stopping = 0`,
  params: [deadlineAt, delegationId, generation],
  abortWhen: 'noChanges',
  abortCode,
});

type CountRunSlotAttemptStatementParams = {
  readonly treeId: AutoTreeId;
  readonly ownerId: string;
  readonly generation: number;
  readonly nowMs: number;
  readonly abortCode: string;
};

export const autoCountRunSlotAttemptStatement = ({
  treeId,
  ownerId,
  generation,
  nowMs,
  abortCode,
}: CountRunSlotAttemptStatementParams): GuardedStatement => ({
  sql: `UPDATE auto_trees
    SET phase_rev = phase_rev + 1, updated_at = ?, attempts_used = attempts_used + 1
    WHERE id = ? AND generation = ? AND stop_state = 'none'
      AND phase IN ('deciding', 'delegating', 'waiting', 'merging')
      AND ${AUTO_OWNER_GUARD_SQL}
      AND ${autoBudgetLeftSql({ treeRef: 'auto_trees.id' })}`,
  params: [nowMs, treeId, generation, ...autoOwnerGuardParams({ ownerId, nowMs })],
  abortWhen: 'noChanges',
  abortCode,
});

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
