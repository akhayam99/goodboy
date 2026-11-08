import {
  AUTO_OWNER_GUARD_SQL,
  autoOwnerGuardParams,
  getAutoDelegation,
  listAutoDelegations,
} from '@goodboy/db';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import { textOf } from '@goodboy/types/helpers';
import { recordField, textField } from '../../../../features/auto/chat/readJson';
import { isAutoReturnDecided } from '../../../../features/auto/isAutoReturnDecided';
import type { AgentCommand, BridgeOutcome } from '../ports';
import { refuseOutcome } from '../refuseOutcome';
import type { AgentVerbContext } from '../verbContext';

export type ReleaseDelegationParams = Readonly<{
  ctx: AgentVerbContext;
  command: AgentCommand;
}>;

const ABORT_TREE = 'release_tree';
const ABORT_DELEGATION = 'release_delegation';

export const releaseDelegation = async ({
  ctx,
  command,
}: ReleaseDelegationParams): Promise<BridgeOutcome> => {
  const { grant, args } = command;
  const delegationText = textOf({ value: args['delegation'] });
  const reason = textOf({ value: args['reason'] });
  if (delegationText === null || reason === null) {
    return refuseOutcome({
      code: 'spec_invalid',
      message: 'a release needs a delegation and a reason',
    });
  }
  const isOwner = await ctx.scheduler.claim({ treeId: grant.treeId });
  if (!isOwner) {
    return refuseOutcome({ code: 'not_owner' });
  }
  const delegationId = brandId<AutoDelegationId>({ value: delegationText });
  const delegation = await getAutoDelegation({ db: ctx.db, delegationId });
  if (delegation === null || delegation.treeId !== grant.treeId) {
    return refuseOutcome({ code: 'delegation_unknown' });
  }
  if (delegation.generation > grant.generation) {
    return refuseOutcome({ code: 'generation_changed' });
  }
  const released = recordField({ source: delegation.request, key: 'released' });
  if (
    released !== null &&
    textField({ source: released, key: 'runId' }) === grant.runId &&
    textField({ source: released, key: 'reason' }) === reason
  ) {
    return { isOk: true, data: { released: delegationId, reason } };
  }
  const delegations = await listAutoDelegations({ db: ctx.db, treeId: grant.treeId });
  if (
    delegation.state !== 'settled' ||
    delegation.outcome !== 'blocked' ||
    isAutoReturnDecided({ delegation, delegations })
  ) {
    return refuseOutcome({ code: 'not_returned' });
  }
  const nowMs = ctx.now();
  const outcome = await ctx.db.transaction({
    statements: [
      {
        sql: `SELECT 1 FROM auto_trees
          WHERE id = ? AND generation = ? AND stop_state = 'none' AND ${AUTO_OWNER_GUARD_SQL}`,
        params: [
          grant.treeId,
          grant.generation,
          ...autoOwnerGuardParams({ ownerId: ctx.scheduler.ownerId, nowMs }),
        ],
        abortWhen: 'noRows',
        abortCode: ABORT_TREE,
      },
      {
        sql: `UPDATE auto_delegations
          SET request_json = json_set(request_json, '$.released', json(?))
          WHERE id = ? AND tree_id = ? AND generation <= ? AND state = 'settled'
            AND outcome = 'blocked' AND json_extract(request_json, '$.released') IS NULL`,
        params: [
          JSON.stringify({ reason, at: nowMs, runId: grant.runId }),
          delegationId,
          grant.treeId,
          grant.generation,
        ],
        abortWhen: 'noChanges',
        abortCode: ABORT_DELEGATION,
      },
      {
        sql: 'UPDATE auto_trees SET phase_rev = phase_rev + 1, updated_at = ? WHERE id = ?',
        params: [nowMs, grant.treeId],
      },
    ],
  });
  if (outcome.status === 'aborted') {
    return refuseOutcome({
      code: outcome.abortCode === ABORT_TREE ? 'generation_changed' : 'not_returned',
    });
  }
  return { isOk: true, data: { released: delegationId, reason } };
};
