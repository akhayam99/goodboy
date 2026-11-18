import {
  AUTO_DELEGATION_DEADLINE_MINUTES,
  AUTO_MAX_RUNNING_CHILDREN,
  AUTO_SUBSTEP_PARENT_SLACK_MS,
  substepLinkOf,
} from '@goodboy/core/auto';
import {
  AUTO_OWNER_GUARD_SQL,
  autoOwnerGuardParams,
  autoTakeRunSlotStatement,
  type AutoDelegation,
  type Statement,
} from '@goodboy/db';

type Params = {
  readonly delegation: AutoDelegation;
  readonly ownerId: string;
  readonly generation: number;
  readonly nowMs: number;
  readonly treeAbortCode: string;
  readonly slotAbortCode: string;
};

export const runSlotStatements = ({
  delegation,
  ownerId,
  generation,
  nowMs,
  treeAbortCode,
  slotAbortCode,
}: Params): ReadonlyArray<Statement> => {
  const deadlineAt = nowMs + AUTO_DELEGATION_DEADLINE_MINUTES * 60_000;
  const parent = substepLinkOf({ request: delegation.request });
  const statements: Statement[] = [
    {
      sql: `SELECT 1 FROM auto_trees
        WHERE id = ? AND generation = ? AND stop_state = 'none' AND ${AUTO_OWNER_GUARD_SQL}`,
      params: [delegation.treeId, generation, ...autoOwnerGuardParams({ ownerId, nowMs })],
      abortWhen: 'noRows',
      abortCode: treeAbortCode,
    },
    autoTakeRunSlotStatement({
      delegationId: delegation.id,
      generation,
      maxRunning: AUTO_MAX_RUNNING_CHILDREN,
      deadlineAt,
      abortCode: slotAbortCode,
    }),
  ];
  if (parent === null) {
    return statements;
  }
  return [
    ...statements,
    {
      sql: 'UPDATE auto_delegations SET deadline_at = MAX(deadline_at, ?) WHERE id = ?',
      params: [deadlineAt + AUTO_SUBSTEP_PARENT_SLACK_MS, parent.delegationId],
    },
  ];
};
