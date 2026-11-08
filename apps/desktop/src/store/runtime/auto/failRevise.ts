import {
  AUTO_OWNER_GUARD_SQL,
  autoOwnerGuardParams,
  type Database,
  type Statement,
} from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import { reviseFailureStatements, type ReviseFailure } from './reviseFailureStatements';

export type FailReviseParams = ReviseFailure &
  Readonly<{
    db: Database;
    ownerId: string;
    nowMs: number;
    treeId: AutoTreeId;
  }>;

export type FailReviseOutcome = Readonly<{ kind: 'failed' }> | Readonly<{ kind: 'dropped' }>;

const ABORT_TREE = 'fail_tree';
const ABORT_DELEGATION = 'fail_delegation';
const ABORT_SETTLE = 'fail_settle';

export const failRevise = async ({
  db,
  ownerId,
  nowMs,
  treeId,
  ...failure
}: FailReviseParams): Promise<FailReviseOutcome> => {
  const statements: Statement[] = [
    {
      sql: `SELECT 1 FROM auto_trees WHERE id = ? AND generation = ? AND ${AUTO_OWNER_GUARD_SQL}`,
      params: [treeId, failure.generation, ...autoOwnerGuardParams({ ownerId, nowMs })],
      abortWhen: 'noRows',
      abortCode: ABORT_TREE,
    },
    {
      sql: 'SELECT 1 FROM auto_delegations WHERE id = ? AND tree_id = ?',
      params: [failure.delegationId, treeId],
      abortWhen: 'noRows',
      abortCode: ABORT_DELEGATION,
    },
    ...reviseFailureStatements({ ...failure, treeId, nowMs, abortCode: ABORT_SETTLE }),
    {
      sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
      params: [nowMs, treeId],
    },
  ];
  const committed = await db.transaction({ statements });
  return committed.status === 'committed' ? { kind: 'failed' } : { kind: 'dropped' };
};
