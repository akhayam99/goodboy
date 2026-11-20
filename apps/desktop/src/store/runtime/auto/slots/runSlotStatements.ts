import {
  AUTO_DELEGATION_DEADLINE_MINUTES,
  AUTO_MAX_RUNNING_CHILDREN,
  AUTO_SUBSTEPS_PER_PARENT,
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
  ];
  if (parent !== null) {
    statements.push({
      sql: `SELECT 1 FROM auto_delegations parent
        WHERE parent.id = ? AND parent.state = 'paused'
          AND (SELECT COUNT(*) FROM auto_delegations helper
                WHERE helper.tree_id = parent.tree_id
                  AND helper.state IN ('starting', 'running', 'paused')
                  AND json_extract(helper.request_json, '$.parent.delegationId') = parent.id) < ?`,
      params: [parent.delegationId, AUTO_SUBSTEPS_PER_PARENT],
      abortWhen: 'noRows',
      abortCode: slotAbortCode,
    });
  }
  statements.push(
    autoTakeRunSlotStatement({
      delegationId: delegation.id,
      generation,
      maxRunning: AUTO_MAX_RUNNING_CHILDREN,
      deadlineAt,
      abortCode: slotAbortCode,
    }),
  );
  return statements;
};
