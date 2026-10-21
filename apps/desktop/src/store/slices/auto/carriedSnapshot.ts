import type { MountSnapshot } from '@goodboy/core';
import { getAutoDelegation, listAutoAttemptsOfDelegation, type AutoDelegation } from '@goodboy/db';
import { snapshotOf } from './attemptBaseline';
import type { AgentVerbContext } from './verbContext';

export type CarriedSnapshotParams = Readonly<{
  ctx: AgentVerbContext;
  delegation: AutoDelegation;
  worktreePath: string;
}>;

export const carriedSnapshot = async ({
  ctx,
  delegation,
  worktreePath,
}: CarriedSnapshotParams): Promise<MountSnapshot | null> => {
  if (delegation.retryOf === null) {
    return null;
  }
  const original = await getAutoDelegation({ db: ctx.db, delegationId: delegation.retryOf });
  if (
    original === null ||
    original.outcome === 'completed' ||
    original.childAgentId !== delegation.childAgentId ||
    original.target['worktreePath'] !== worktreePath
  ) {
    return null;
  }
  const attempts = await listAutoAttemptsOfDelegation({ db: ctx.db, delegationId: original.id });
  const first = attempts[0];
  return first === undefined ? null : snapshotOf({ baseline: first.baseline });
};
