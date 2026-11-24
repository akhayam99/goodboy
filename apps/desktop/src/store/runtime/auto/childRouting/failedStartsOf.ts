import type { AutoDelegationRole } from '@goodboy/core/auto';
import { listAutoAttemptsOfTree, listAutoDelegations, type AutoTree } from '@goodboy/db';
import type { ProviderId } from '@goodboy/types';
import type { AgentVerbContext } from '../verbContext';
import { isStartFailure } from './isStartFailure';
import { storedPickOf } from './storedPickOf';

type Params = {
  readonly ctx: Pick<AgentVerbContext, 'db'>;
  readonly tree: Pick<AutoTree, 'id' | 'generation'>;
  readonly role: AutoDelegationRole;
};

export const failedStartsOf = async ({
  ctx,
  tree,
  role,
}: Params): Promise<ReadonlyArray<ProviderId>> => {
  const attempts = await listAutoAttemptsOfTree({ db: ctx.db, treeId: tree.id });
  const failed = new Set(
    attempts
      .filter(
        (attempt) =>
          attempt.generation === tree.generation &&
          isStartFailure({ endReason: attempt.endReason }),
      )
      .map((attempt) => attempt.delegationId),
  );
  if (failed.size === 0) {
    return [];
  }
  const delegations = await listAutoDelegations({ db: ctx.db, treeId: tree.id });
  const providers = delegations.flatMap((delegation) => {
    const pick = storedPickOf({ routing: delegation.routing });
    return failed.has(delegation.id) && delegation.role === role && pick !== null
      ? [pick.provider]
      : [];
  });
  return [...new Set(providers)];
};
