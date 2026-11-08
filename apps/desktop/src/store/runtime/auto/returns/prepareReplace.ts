import { AUTO_REFUSAL_TEXT, AUTO_TREE_LIMITS, type DelegateChildSpec } from '@goodboy/core/auto';
import { listAutoDelegations, type AutoTree } from '@goodboy/db';
import { delegationReplacesOf } from '../../../../features/auto/delegationReplacesOf';
import { rebriefCountOf, type RebriefLink } from './rebriefCountOf';
import { targetRefusalOf } from './targetRefusalOf';
import type { ChildRefusal } from '../resolveDelegateChild';
import type { AgentVerbContext } from '../verbContext';

export type PrepareReplaceParams = Readonly<{
  ctx: AgentVerbContext;
  tree: AutoTree;
  child: DelegateChildSpec;
  slot: number;
  batchRebriefs: ReadonlyArray<RebriefLink>;
  isConfirmGated: boolean;
}>;

export const prepareReplace = async ({
  ctx,
  tree,
  child,
  slot,
  batchRebriefs,
  isConfirmGated,
}: PrepareReplaceParams): Promise<ChildRefusal | null> => {
  if (child.replaces === null) {
    return null;
  }
  const delegations = await listAutoDelegations({ db: ctx.db, treeId: tree.id });
  const replaced = delegations.find((delegation) => delegation.id === child.replaces);
  if (replaced === undefined) {
    return {
      slot,
      code: 'delegation_unknown',
      message: 'the agent named in "replaces" does not belong to this conversation',
    };
  }
  if (replaced.state !== 'settled') {
    return {
      slot,
      code: 'retry_unavailable',
      message: 'the agent named in "replaces" has not finished, so it cannot be replaced yet',
    };
  }
  const targetRefusal = targetRefusalOf({ target: replaced, delegations, slot });
  if (targetRefusal !== null) {
    return targetRefusal;
  }
  const isReplacedInBatch = batchRebriefs.some(
    (row) => delegationReplacesOf({ delegation: row }) === replaced.id,
  );
  if (isConfirmGated || isReplacedInBatch) {
    return null;
  }
  if (
    rebriefCountOf({ delegation: replaced, delegations: [...delegations, ...batchRebriefs] }) + 1 >
    AUTO_TREE_LIMITS.rebriefsPerTask
  ) {
    return { slot, code: 'task_rebrief_limit', message: AUTO_REFUSAL_TEXT.task_rebrief_limit };
  }
  return null;
};
