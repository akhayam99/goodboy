import { AUTO_REFUSAL_TEXT, AUTO_TREE_LIMITS, type DelegateChildSpec } from '@goodboy/core/auto';
import { listAutoDelegations, type AutoTree } from '@goodboy/db';
import { brandId, type AutoDelegationId } from '@goodboy/types';
import { rebriefCountOf } from './rebriefCountOf';
import { targetRefusalOf } from './targetRefusalOf';
import type { ChildRefusal } from '../resolveDelegateChild';
import type { AgentVerbContext } from '../verbContext';

export type PrepareReplaceParams = Readonly<{
  ctx: AgentVerbContext;
  tree: AutoTree;
  child: DelegateChildSpec;
  slot: number;
  batchReplaces: ReadonlyArray<string>;
  batchTargets: ReadonlySet<string>;
  isConfirmGated: boolean;
}>;

export const prepareReplace = async ({
  ctx,
  tree,
  child,
  slot,
  batchReplaces,
  batchTargets,
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
  const targetRefusal = targetRefusalOf({ target: replaced, delegations, batchTargets, slot });
  if (targetRefusal !== null) {
    return targetRefusal;
  }
  if (isConfirmGated) {
    return null;
  }
  const prepared = batchReplaces.map((replaces, index) => ({
    id: brandId<AutoDelegationId>({ value: `batch-replace-${String(index)}` }),
    retryOf: null,
    request: { replaces },
  }));
  if (
    rebriefCountOf({ delegation: replaced, delegations: [...delegations, ...prepared] }) + 1 >
    AUTO_TREE_LIMITS.rebriefsPerTask
  ) {
    return { slot, code: 'task_rebrief_limit', message: AUTO_REFUSAL_TEXT.task_rebrief_limit };
  }
  return null;
};
