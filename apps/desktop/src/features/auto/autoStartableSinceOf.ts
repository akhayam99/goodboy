import { AUTO_DELEGATION_DEADLINE_MINUTES, AUTO_MAX_RUNNING_CHILDREN } from '@goodboy/core/auto';
import type { AutoDelegation, AutoRunSlots, AutoTree } from '@goodboy/db';

type Params = {
  readonly tree: Pick<AutoTree, 'phase' | 'activeRunId'>;
  readonly runSlots: AutoRunSlots;
  readonly delegation: Pick<AutoDelegation, 'state' | 'createdAt' | 'deadlineAt'>;
};

const LAUNCH_PHASES: ReadonlyArray<AutoTree['phase']> = ['delegating', 'waiting', 'merging'];

export const autoStartableSinceOf = ({ tree, runSlots, delegation }: Params): number | null => {
  if (delegation.state !== 'accepted') {
    return delegation.deadlineAt - AUTO_DELEGATION_DEADLINE_MINUTES * 60_000;
  }
  if (tree.activeRunId !== null || !LAUNCH_PHASES.includes(tree.phase)) {
    return null;
  }
  if (runSlots.running >= AUTO_MAX_RUNNING_CHILDREN) {
    return null;
  }
  return Math.max(delegation.createdAt, runSlots.freedAt);
};
